// Rate limits (spec 12): per user on the costly routes, per hashed IP on the public ones. Counts live in the database
// (api_rate_check), so they hold across serverless instances. The IP is hashed: only the hash is stored.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "../auth/server";

export const LIMITS = {
  turn: { limit: 20, windowSeconds: 60 }, // teacher messages per user per minute
  voice: { limit: 40, windowSeconds: 60 }, // sentences of speech per user per minute
  rehearsal: { limit: 6, windowSeconds: 600 }, // rehearsal analyses per user per 10 minutes
  illustration: { limit: 6, windowSeconds: 60 },
  events: { limit: 120, windowSeconds: 60 },
  public: { limit: 60, windowSeconds: 60 }, // per IP, routes without login
} as const;

export function clientKey(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return "ip:" + createHash("sha256").update(`pf|${ip}`).digest("hex").slice(0, 24);
}

/** Throws HttpError 429 (with retry hint) when the key is over its limit. If the counter itself fails, the request is allowed (fail open). */
export async function enforceRate(db: SupabaseClient, key: string, rule: { limit: number; windowSeconds: number }): Promise<void> {
  const { data, error } = await db.rpc("api_rate_check", { p_key: key, p_limit: rule.limit, p_window_seconds: rule.windowSeconds });
  if (error) return;
  if (data === false) throw new HttpError(429, "rate_limited", { retryAfterSeconds: rule.windowSeconds });
}
