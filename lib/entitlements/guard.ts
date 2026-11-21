// Plan checks for the API routes that cost money or are reserved to a plan. They read ONLY lib/entitlements (never the payment provider).
import type { SupabaseClient } from "@supabase/supabase-js";
import { track } from "../analytics/track";
import { HttpError } from "../auth/server";
import { can, checkLimit, type Access, type Feature, type LimitKind } from "./index";
import { loadAccess, loadUsage } from "./server";

const NEEDS: Record<Feature, "plus" | "premium"> = { sermon: "premium", pdf_export: "plus", deepen_full: "premium" };

export async function requireFeature(db: SupabaseClient, userId: string, feature: Feature): Promise<Access> {
  const access = await loadAccess(db, userId);
  if (!can(access, feature)) throw new HttpError(403, "plan_required", { feature, needs: NEEDS[feature], plan: access.plan });
  return access;
}

/** Throws 429 {error:"limit"} when the student reached the limit of their plan for this kind of use. */
export async function enforceLimit(db: SupabaseClient, userId: string, kind: LimitKind): Promise<Access> {
  const [access, usage] = await Promise.all([loadAccess(db, userId), loadUsage(db, userId)]);
  const r = checkLimit(access, usage, kind);
  if (!r.ok) {
    track(db, "limit_reached", { kind, plan: access.plan });
    throw new HttpError(429, "limit", { kind, limit: r.limit, used: r.used, plan: access.plan, upgrade: access.plan === "free" ? "plus" : "premium" });
  }
  return access;
}

export async function addUsage(db: SupabaseClient, kind: "voice_seconds" | "text_messages" | "deep_calls" | "cost_brl", amount: number) {
  await db.rpc("api_usage_add", { p_kind: kind, p_amount: amount });
}

/** Rough cost of one answer in BRL from the token use (Sonnet 5.5 list prices, 1 USD = 5.5 BRL): input, output, cache read/write. */
export function costBrl(u?: { input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  if (!u) return 0;
  const usd = (u.input * 3 + u.output * 15 + u.cacheRead * 0.3 + u.cacheWrite * 3.75) / 1_000_000;
  return Math.round(usd * 5.5 * 10000) / 10000;
}
