// The router: picks an endpoint, calls it, and on a rate limit, exhausted quota, bad key, outage or unusable answer moves to the next one.
// Designed for many parallel users: load is spread across tiers and keys (weighted random), cooling endpoints are skipped by every instance
// (shared state), bursts are capped per key, and when everything is busy it waits a little for the earliest endpoint instead of failing.
import { callGemini, callOpenAI, type RawResult } from "./clients";
import { ensureDiscovery } from "./discovery";
import { buildEndpoints } from "./registry";
import { SharedStore, type HealthStore } from "./state";
import { LlmError, type Endpoint, type Failure, type LlmRequest, type LlmResult } from "./types";

export interface RouterDeps {
  endpoints?: () => Endpoint[];
  store?: HealthStore;
  call?: (e: Endpoint, req: LlmRequest) => Promise<RawResult>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  /** Longest total wait for a cooling endpoint before giving up (ms). */
  maxWaitMs?: number;
  /** Whole call budget in ms (the serverless function has 60 s): a slow free model must not eat all of it. */
  deadlineMs?: number;
}

const inflight = new Map<string, number>();
/** Consecutive unexplained failures per endpoint: a model that keeps failing (removed, unsupported parameter...) is parked for a while. */
const streaks = new Map<string, number>();
let defaultStore: HealthStore | null = null;
const realCall = (e: Endpoint, req: LlmRequest) => (e.kind === "gemini" ? callGemini(e, req) : callOpenAI(e, req));

/** How long each kind of failure keeps an endpoint out of the pool (seconds). */
export function cooldownFor(f: Failure, retryAfter: number): number {
  switch (f) {
    case "rate_limit": return Math.min(120, Math.max(8, retryAfter || 30));
    case "quota": return 3600; // daily quota or no credit: try again in an hour
    case "auth": return 1800; // wrong or revoked key
    case "gone": return 21600; // the model was removed
    case "server": case "timeout": return 20;
    default: return 0;
  }
}

/** Weighted random order inside each tier; tiers by preference (strongest first for answers, cheapest first for tiny tasks). */
export function order(list: Endpoint[], req: LlmRequest, random: () => number): Endpoint[] {
  const small = req.task === "query" || req.task === "text";
  const tiers = [...new Set(list.map((e) => e.tier))].sort((a, b) => (small ? b - a : a - b));
  const out: Endpoint[] = [];
  for (const t of tiers) {
    const pool = list.filter((e) => e.tier === t).map((e) => ({ e, k: Math.pow(random(), 1 / Math.max(0.01, e.weight)) + (req.tool && e.tools ? 1 : 0) }));
    pool.sort((a, b) => b.k - a.k); // Efraimidis-Spirakis weighted shuffle; tool-capable endpoints first for structured answers
    out.push(...pool.map((p) => p.e));
  }
  return out;
}

export async function route(req: LlmRequest, deps: RouterDeps = {}): Promise<LlmResult> {
  if (!deps.endpoints) await ensureDiscovery(); // free model names are refreshed every few hours (best effort)
  const endpoints = (deps.endpoints ?? buildEndpoints)();
  const store = deps.store ?? (defaultStore ??= new SharedStore());
  const call = deps.call ?? realCall;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;
  const maxWait = deps.maxWaitMs ?? 12000;
  const deadline = now() + (deps.deadlineMs ?? req.deadlineMs ?? 48000);
  const log: string[] = [];
  if (!endpoints.length) throw new LlmError("auth", 0, 0, "no_providers_configured");

  const tried = new Set<string>();
  let attempts = 0, waited = 0, bad = 0;
  let last: LlmError | null = null;
  while (attempts < Math.min(10, endpoints.length + 3)) {
    if (now() >= deadline) throw last ?? new LlmError("timeout", 0, 0, "deadline");
    const cooling = await store.cooldowns();
    const free = endpoints.filter((e) => !tried.has(e.id) && (cooling.get(e.id) ?? 0) <= now() && (inflight.get(e.id) ?? 0) < e.concurrency);
    const pick = order(free, req, random)[0];
    if (!pick) {
      // everything is cooling down or already tried: wait for the earliest endpoint (bounded), else give up with a retry hint
      const waits = endpoints.filter((e) => (cooling.get(e.id) ?? 0) > now()).map((e) => (cooling.get(e.id) ?? 0) - now());
      const next = waits.length ? Math.min(...waits) : 0;
      if (next > 0 && waited + next <= maxWait) { await sleep(next + 50); waited += next + 50; tried.clear(); continue; }
      throw last ?? new LlmError("rate_limit", 429, Math.ceil(next / 1000) || 30, "all_endpoints_busy");
    }
    tried.add(pick.id);
    attempts++;
    // One attempt on one endpoint: calls it, records the result and, on failure, pauses it (and rethrows).
    const attemptOn = async (ep: Endpoint): Promise<LlmResult> => {
      inflight.set(ep.id, (inflight.get(ep.id) ?? 0) + 1);
      const t0 = now();
      try {
        // each attempt gets what is left of the budget (at most the request's own timeout), so one slow endpoint cannot use it all
        const raw = await call(ep, { ...req, timeoutMs: Math.max(4000, Math.min(req.timeoutMs ?? 30000, deadline - now())) });
        if (req.validate && !req.validate(raw.out)) throw new LlmError("bad_output", 200, 0, "validation");
        streaks.delete(ep.id);
        store.record(ep.id, true, null, now() - t0);
        log.push(`${ep.id}:ok:${now() - t0}`);
        return { out: raw.out, text: raw.text, endpoint: ep.id, provider: ep.provider, model: ep.model, ms: now() - t0, attempts, log };
      } catch (e) {
        const err = e instanceof LlmError ? e : new LlmError("other", 0, 0, String((e as Error).message).slice(0, 80));
        log.push(`${ep.id}:${err.kind}:${now() - t0}`);
        store.record(ep.id, false, err.kind, now() - t0);
        let cd = cooldownFor(err.kind, err.retryAfter);
        if (cd === 0 || err.kind === "server" || err.kind === "timeout") {
          const n = (streaks.get(ep.id) ?? 0) + 1;
          streaks.set(ep.id, n);
          if (n >= 3) { cd = Math.max(cd, 300); streaks.set(ep.id, 0); } // three failures in a row: park it for 5 minutes
        }
        console.log(JSON.stringify({ evt: "llm_fail", endpoint: ep.id, kind: err.kind, status: err.status, detail: err.message.slice(0, 120) }));
        const reason = `${err.kind}: ${err.message.replace(/^llm_\w+_\d+:?\s*/, "")}`.replace(/\s+/g, " ").slice(0, 150);
        // A daily quota, no credit or a wrong key belongs to the whole account/key, not to one model: pause every endpoint that uses it,
        // instead of spending a call on each sibling model just to learn the same thing.
        const wholeKey = err.kind === "quota" || err.kind === "auth" || (err.kind === "other" && /api key not valid|invalid api key|unauthorized/i.test(err.message));
        if (wholeKey && cd === 0) cd = 1800;
        if (cd > 0) {
          const targets = wholeKey ? endpoints.filter((e2) => e2.provider === ep.provider && e2.keyIndex === ep.keyIndex) : [ep];
          // not awaited: the pause is already in memory for this instance; saving it for the other instances must not make the student wait
          for (const t of targets) void store.setCooldown(t.id, cd + Math.round(random() * 3), reason).catch(() => undefined);
        }
        throw err;
      } finally {
        inflight.set(ep.id, Math.max(0, (inflight.get(ep.id) ?? 1) - 1));
      }
    };
    try {
      if (!req.hedgeAfterMs) return { ...(await attemptOn(pick)), attempts, log };
      // Hedged call: when the first endpoint is slow, ask a second one too and take whichever answers first (free models have long tails).
      const p1 = attemptOn(pick);
      p1.catch(() => undefined);
      const early = await Promise.race([p1.then((r) => ({ r }), (err) => ({ err })), sleep(req.hedgeAfterMs).then(() => null)]);
      if (early) { if ("r" in early) return { ...early.r, attempts, log }; throw early.err; }
      const cool2 = await store.cooldowns();
      const alt = order(endpoints.filter((e) => !tried.has(e.id) && (cool2.get(e.id) ?? 0) <= now() && (inflight.get(e.id) ?? 0) < e.concurrency), req, random)[0];
      if (!alt) return { ...(await p1), attempts, log };
      tried.add(alt.id);
      attempts++;
      try {
        const win = await Promise.any([p1, attemptOn(alt)]);
        return { ...win, attempts, log };
      } catch (agg) {
        const errs = (agg as AggregateError).errors ?? [agg];
        throw errs[errs.length - 1];
      }
    } catch (e) {
      last = e instanceof LlmError ? e : new LlmError("other", 0, 0, String((e as Error).message).slice(0, 80));
      if (last.kind === "bad_output" && ++bad >= 3) throw last;
    }
  }
  throw last ?? new LlmError("other", 0, 0, "no_attempt");
}

/** Convenience wrappers. */
export async function completeJson(system: string, user: string, opts: { task?: LlmRequest["task"]; maxTokens?: number; temperature?: number; timeoutMs?: number; deadlineMs?: number; validate?: (o: unknown) => boolean } = {}, deps?: RouterDeps) {
  return route({ task: opts.task ?? "json", system, messages: [{ role: "user", content: user }], json: true, maxTokens: opts.maxTokens ?? 1800, temperature: opts.temperature ?? 0.5, timeoutMs: opts.timeoutMs, deadlineMs: opts.deadlineMs, validate: opts.validate }, deps);
}
export async function completeText(system: string, user: string, opts: { maxTokens?: number; temperature?: number } = {}, deps?: RouterDeps) {
  return route({ task: "text", system, messages: [{ role: "user", content: user }], maxTokens: opts.maxTokens ?? 1800, temperature: opts.temperature ?? 0.2 }, deps);
}
