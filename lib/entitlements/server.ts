// Server side of the access rights: reading (with the student's token, RLS) and granting/revoking (with the server secret).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accessFor, planFromEntitlements, type Access, type EntitlementSource, type PlanRow, type Usage } from "./index";

let plansCache: { at: number; rows: PlanRow[] } | null = null;
export async function loadPlans(db: SupabaseClient): Promise<PlanRow[]> {
  if (plansCache && Date.now() - plansCache.at < 60_000) return plansCache.rows;
  const { data } = await db.from("plans").select("id, name, price_month, price_year, limits, features").eq("active", true).order("price_month");
  plansCache = { at: Date.now(), rows: (data ?? []) as PlanRow[] };
  return plansCache.rows;
}

/** What the student can do now: reads ONLY `entitlements` (and the plans table for the limits). */
export async function loadAccess(db: SupabaseClient, userId: string, now = new Date()): Promise<Access> {
  const [{ data: ents }, plans] = await Promise.all([db.from("entitlements").select("entitlement, source, status, expires_at").eq("user_id", userId), loadPlans(db)]);
  return accessFor(planFromEntitlements(ents ?? [], now), plans);
}

/** Today's and this month's usage of what costs money. */
export async function loadUsage(db: SupabaseClient, userId: string): Promise<Usage> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [{ data: row }, lessons, deep] = await Promise.all([
    db.from("usage_counters").select("voice_seconds, text_messages, illustrations").eq("user_id", userId).eq("day", today).maybeSingle(),
    db.from("sessions").select("id", { count: "exact", head: true }).eq("mode", "lesson").gte("started_at", monthStart),
    db.from("sessions").select("id", { count: "exact", head: true }).eq("mode", "deep").gte("started_at", monthStart),
  ]);
  return { text_messages_day: row?.text_messages ?? 0, voice_minutes_day: Math.ceil((row?.voice_seconds ?? 0) / 60), illustrations_day: row?.illustrations ?? 0, lessons_month: lessons.count ?? 0, deepen_month: deep.count ?? 0 };
}

// ---- writing rights: only the server (webhooks, admin tools) holds the secret ----
function secret() {
  const s = process.env.BILLING_SERVER_SECRET;
  if (!s) throw new Error("billing_secret_missing");
  return s;
}
export function serverDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function grantEntitlement(userId: string, entitlement: string, source: EntitlementSource, sourceRef: string | null, expiresAt: Date | null, db = serverDb()) {
  const { error } = await db.rpc("api_entitlement_grant", { p_secret: secret(), p_user: userId, p_entitlement: entitlement, p_source: source, p_ref: sourceRef, p_expires: expiresAt?.toISOString() ?? null });
  if (error) throw new Error(`grant_failed: ${error.message.slice(0, 80)}`);
}

export async function revokeEntitlement(userId: string, entitlement: string, source: EntitlementSource, db = serverDb()) {
  const { error } = await db.rpc("api_entitlement_revoke", { p_secret: secret(), p_user: userId, p_entitlement: entitlement, p_source: source });
  if (error) throw new Error(`revoke_failed: ${error.message.slice(0, 80)}`);
}
export { secret as billingSecret };
