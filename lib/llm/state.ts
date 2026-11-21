// Health of every endpoint, shared by all serverless instances: a cooldown (until when an endpoint must not be called) is kept in memory
// and mirrored in the database (secret-protected functions), so when one instance sees a 429 the others stop hitting that key too.
import { createClient } from "@supabase/supabase-js";
import type { Failure } from "./types";

export interface HealthStore {
  /** endpoint id -> ms epoch until which it is cooling down. */
  cooldowns(): Promise<Map<string, number>>;
  setCooldown(id: string, seconds: number, reason: string): Promise<void>;
  record(id: string, ok: boolean, kind: Failure | null, ms: number): void;
}

const secret = () => process.env.BILLING_SERVER_SECRET ?? "";
const db = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
};

export class MemoryStore implements HealthStore {
  private cd = new Map<string, number>();
  constructor(private clock: () => number = Date.now) {}
  async cooldowns() { const now = this.clock(); for (const [k, v] of this.cd) if (v <= now) this.cd.delete(k); return new Map(this.cd); }
  async setCooldown(id: string, seconds: number, reason?: string) { void reason; this.cd.set(id, this.clock() + seconds * 1000); }
  record() { /* no metrics in memory-only mode */ }
}

/** Memory first (instant), database as the shared layer (refreshed every few seconds; failures never break a request). */
export class SharedStore implements HealthStore {
  private mem = new MemoryStore();
  private fetchedAt = 0;
  private shared = new Map<string, number>();
  constructor(private ttlMs = 5000) {}

  async cooldowns() {
    const local = await this.mem.cooldowns();
    const c = db();
    if (c && secret() && Date.now() - this.fetchedAt > this.ttlMs) {
      this.fetchedAt = Date.now();
      try {
        const { data } = await c.rpc("api_llm_cooldowns", { p_secret: secret() });
        this.shared = new Map(((data ?? []) as { id: string; until_ms: number }[]).map((r) => [r.id, Number(r.until_ms)]));
      } catch { /* keep the previous view */ }
    }
    const now = Date.now();
    for (const [k, v] of this.shared) if (v > now && (local.get(k) ?? 0) < v) local.set(k, v);
    return local;
  }

  async setCooldown(id: string, seconds: number, reason: string) {
    await this.mem.setCooldown(id, seconds);
    const c = db();
    if (c && secret()) void Promise.resolve(c.rpc("api_llm_set_cooldown", { p_secret: secret(), p_id: id, p_seconds: Math.round(seconds), p_reason: reason })).then(() => undefined, () => undefined);
  }

  record(id: string, ok: boolean, kind: Failure | null, ms: number) {
    const c = db();
    if (c && secret()) void Promise.resolve(c.rpc("api_llm_record", { p_secret: secret(), p_id: id, p_ok: ok, p_kind: kind ?? "", p_ms: Math.round(ms) })).then(() => undefined, () => undefined);
  }
}
