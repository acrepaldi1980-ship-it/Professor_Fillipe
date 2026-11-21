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
  const deadline = now() + (deps.deadlineMs ?? 48000);
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
    inflight.set(pick.id, (inflight.get(pick.id) ?? 0) + 1);
    const t0 = now();
    try {
      // each attempt gets what is left of the budget (at most the request's own timeout), so one slow endpoint cannot use it all
      const raw = await call(pick, { ...req, timeoutMs: Math.max(4000, Math.min(req.timeoutMs ?? 30000, deadline - now())) });
      if (req.validate && !req.validate(raw.out)) throw new LlmError("bad_output", 200, 0, "validation");
      streaks.delete(pick.id);
      store.record(pick.id, true, null, now() - t0);
      return { out: raw.out, text: raw.text, endpoint: pick.id, provider: pick.provider, model: pick.model, ms: now() - t0, attempts };
    } catch (e) {
      const err = e instanceof LlmError ? e : new LlmError("other", 0, 0, String((e as Error).message).slice(0, 80));
      last = err;
      store.record(pick.id, false, err.kind, now() - t0);
      let cd = cooldownFor(err.kind, err.retryAfter);
      if (cd === 0 || err.kind === "server" || err.kind === "timeout") {
        const n = (streaks.get(pick.id) ?? 0) + 1;
        streaks.set(pick.id, n);
        if (n >= 3) { cd = Math.max(cd, 300); streaks.set(pick.id, 0); } // three failures in a row: park it for 5 minutes
      }
      console.log(JSON.stringify({ evt: "llm_fail", endpoint: pick.id, kind: err.kind, status: err.status, detail: err.message.slice(0, 120) }));
      if (cd > 0) await store.setCooldown(pick.id, cd + Math.round(random() * 3), `${err.kind}: ${err.message.replace(/^llm_\w+_\d+:?\s*/, "")}`.replace(/\s+/g, " ").slice(0, 150)); // a little jitter so instances do not return together
      if (err.kind === "bad_output" && ++bad >= 3) throw err;
    } finally {
      inflight.set(pick.id, Math.max(0, (inflight.get(pick.id) ?? 1) - 1));
    }
  }
  throw last ?? new LlmError("other", 0, 0, "no_attempt");
}

/** Convenience wrappers. */
export async function completeJson(system: string, user: string, opts: { task?: LlmRequest["task"]; maxTokens?: number; temperature?: number; timeoutMs?: number; validate?: (o: unknown) => boolean } = {}, deps?: RouterDeps) {
  return route({ task: opts.task ?? "json", system, messages: [{ role: "user", content: user }], json: true, maxTokens: opts.maxTokens ?? 1800, temperature: opts.temperature ?? 0.5, timeoutMs: opts.timeoutMs, validate: opts.validate }, deps);
}
export async function completeText(system: string, user: string, opts: { maxTokens?: number; temperature?: number } = {}, deps?: RouterDeps) {
  return route({ task: "text", system, messages: [{ role: "user", content: user }], maxTokens: opts.maxTokens ?? 1800, temperature: opts.temperature ?? 0.2 }, deps);
}
