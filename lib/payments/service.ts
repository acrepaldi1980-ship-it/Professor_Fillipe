// Billing service: checkout, webhook processing (idempotent), cancellation. The ONLY things it writes about access are `subscriptions`
// (the provider's side of the story) and `entitlements` (what the app reads). Every write uses the server secret (SECURITY DEFINER).
import type { SupabaseClient } from "@supabase/supabase-js";
import { billingSecret, grantEntitlement, loadPlans, revokeEntitlement, serverDb } from "../entitlements/server";
import type { PlanId } from "../entitlements";
import { AsaasProvider } from "./asaas";
import { SimulatedProvider } from "./simulated";
import { entitlementExpiry, hasPaidAccess, NO_SUB, tick, transition, TRIAL_DAYS, type Sub, type SubEvent } from "./state";
import type { BillingCycle, CheckoutRequest, NormalizedEvent, PayMethod, PaymentProvider } from "./types";

export function getProvider(name = process.env.PAYMENT_PROVIDER ?? "simulated"): PaymentProvider {
  return name === "asaas" ? new AsaasProvider() : new SimulatedProvider();
}

interface SubRow {
  id: string;
  user_id: string;
  plan_id: PlanId;
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cycle: BillingCycle;
  overdue_since: string | null;
}
const d = (v: string | null) => (v ? new Date(v) : null);
export const rowToSub = (r: Pick<SubRow, "status" | "current_period_end" | "trial_end" | "canceled_at" | "overdue_since">): Sub => ({ status: r.status as Sub["status"], periodEnd: d(r.current_period_end), trialEnd: d(r.trial_end), overdueSince: d(r.overdue_since), canceledAt: d(r.canceled_at) });
const periodDays = (c: BillingCycle) => (c === "year" ? 365 : 30);
const entSource = (provider: string) => (provider === "asaas" ? ("asaas" as const) : ("admin" as const));

async function saveSub(db: SupabaseClient, provider: string, ref: string, userId: string, plan: PlanId, cycle: BillingCycle, s: Sub) {
  const { error } = await db.rpc("api_billing_subscription", {
    p_secret: billingSecret(), p_user: userId, p_plan: plan, p_status: s.status ?? "expired", p_provider: provider, p_ref: ref,
    p_period_end: s.periodEnd?.toISOString() ?? null, p_trial_end: s.trialEnd?.toISOString() ?? null, p_canceled_at: s.canceledAt?.toISOString() ?? null, p_cycle: cycle, p_overdue_since: s.overdueSince?.toISOString() ?? null,
  });
  if (error) throw new Error(`subscription_save_failed: ${error.message.slice(0, 80)}`);
}

/** Writes the access right that matches the subscription (or removes it). The app reads only this. */
export async function syncEntitlement(db: SupabaseClient, provider: string, ref: string, userId: string, plan: PlanId, s: Sub, now = new Date()) {
  const name = `plan:${plan}`;
  if (hasPaidAccess(s, now)) await grantEntitlement(userId, name, entSource(provider), ref, entitlementExpiry(tick(s, now)), db);
  else await revokeEntitlement(userId, name, entSource(provider), db);
}

export type ApplyResult = "applied" | "duplicate" | "unknown_subscription" | "ignored";

/** Webhook processing: log the event once (idempotent), move the state machine, sync the access right. */
export async function applyEvent(ev: NormalizedEvent, provider: string, db: SupabaseClient = serverDb(), now = new Date()): Promise<ApplyResult> {
  const { data: fresh, error } = await db.rpc("api_billing_event", { p_secret: billingSecret(), p_provider: provider, p_type: ev.type, p_key: ev.key, p_payload: ev.raw as object });
  if (error) throw new Error("event_log_failed");
  if (!fresh) return "duplicate";
  if (ev.type === "ignored") return "ignored";
  const { data: rows } = await db.rpc("api_billing_find_subscription", { p_secret: billingSecret(), p_provider: provider, p_ref: ev.providerRef });
  const row = (rows as SubRow[] | null)?.[0];
  if (!row) return "unknown_subscription";
  let sub = tick(rowToSub(row), now);
  const e: SubEvent =
    ev.type === "payment_confirmed" ? { type: "payment_confirmed", at: ev.at, periodEnd: ev.periodEnd ?? new Date(Math.max(now.getTime(), sub.periodEnd?.getTime() ?? 0) + periodDays(row.cycle) * 86_400_000) }
    : ev.type === "payment_overdue" ? { type: "payment_overdue", at: ev.at }
    : ev.type === "subscription_deleted" ? { type: "subscription_deleted", at: ev.at }
    : { type: "trial_started", at: ev.at };
  const wasActive = sub.status === "active";
  sub = transition(sub, e);
  await saveSub(db, provider, ev.providerRef, row.user_id, row.plan_id, row.cycle, sub);
  if (sub.status === "active" && !wasActive) void db.rpc("api_billing_track", { p_secret: billingSecret(), p_user: row.user_id, p_event: "subscription_activated", p_props: { plan: row.plan_id, cycle: row.cycle } });
  await syncEntitlement(db, provider, ev.providerRef, row.user_id, row.plan_id, sub, now);
  // a church subscription also opens or closes the church and the access rights of all its members
  if (String(row.plan_id).startsWith("church_")) await db.rpc("api_billing_church_sync", { p_secret: billingSecret(), p_provider: provider, p_ref: ev.providerRef });
  await db.rpc("api_billing_processed", { p_secret: billingSecret(), p_key: ev.key });
  return "applied";
}

export interface StartCheckout {
  userId: string;
  email: string;
  name: string;
  plan: Exclude<PlanId, "free">;
  cycle: BillingCycle;
  method: PayMethod;
}

/** Creates the subscription at the provider, records it, and (Premium, first time) starts the 7-day trial at once. */
export async function startCheckout(userDb: SupabaseClient, input: StartCheckout, provider = getProvider(), db: SupabaseClient = serverDb(), now = new Date()) {
  const plans = await loadPlans(db);
  const p = plans.find((x) => x.id === input.plan);
  if (!p) throw new Error("plan_not_found");
  const amount = Number(input.cycle === "year" ? p.price_year ?? Number(p.price_month) * 12 : p.price_month);
  // a trial only the first time: a student who already had any subscription does not get another
  const { count } = await userDb.from("subscriptions").select("id", { count: "exact", head: true });
  const trialDays = Number(p.features.trial_days ?? 0);
  const trial = trialDays > 0 && (count ?? 0) === 0;
  const req: CheckoutRequest = { ...input, trial, amountBrl: amount };
  const out = await provider.createCheckout(req);
  let sub: Sub = NO_SUB;
  if (trial) sub = transition(sub, { type: "trial_started", at: now, trialDays: trialDays || TRIAL_DAYS });
  else sub = { ...NO_SUB, status: "expired" }; // placeholder until the first payment is confirmed (no access)
  await saveSub(db, provider.name, out.providerRef, input.userId, input.plan, input.cycle, sub);
  await syncEntitlement(db, provider.name, out.providerRef, input.userId, input.plan, sub, now);
  return { ...out, trial, amount };
}

/** The student cancels: access stays until the end of the paid period (state `canceled`). */
export async function cancelSubscription(userDb: SupabaseClient, userId: string, provider = getProvider(), db: SupabaseClient = serverDb(), now = new Date()) {
  const { data } = await userDb.from("subscriptions").select("*").eq("user_id", userId).in("status", ["trialing", "active", "past_due"]).order("created_at", { ascending: false }).limit(1);
  const row = (data as (SubRow & { provider: string; provider_ref: string })[] | null)?.[0];
  if (!row) return false;
  await getProvider(row.provider === "asaas" ? "asaas" : "simulated").cancelSubscription(row.provider_ref);
  const sub = transition(tick(rowToSub(row), now), { type: "cancel_requested", at: now });
  await saveSub(db, row.provider, row.provider_ref, userId, row.plan_id, row.cycle, sub);
  await syncEntitlement(db, row.provider, row.provider_ref, userId, row.plan_id, sub, now);
  void provider;
  return true;
}

/** The church administrator pays for the church plan chosen when the church was created. Access opens only when the payment is confirmed. */
export async function startChurchCheckout(userDb: SupabaseClient, input: { userId: string; email: string; name: string; churchId: string; cycle: BillingCycle; method: PayMethod }, provider = getProvider(), db: SupabaseClient = serverDb(), now = new Date()) {
  const { data: mine } = await userDb.rpc("api_church_my");
  const church = (mine as { id: string; role: string; plan_id: string }[] | null)?.find((c) => c.id === input.churchId);
  if (!church || church.role !== "admin") throw new Error("forbidden");
  const plans = await loadPlans(db);
  const p = plans.find((x) => (x.id as string) === church.plan_id);
  if (!p) throw new Error("plan_not_found");
  const amount = Number(input.cycle === "year" ? p.price_year ?? Number(p.price_month) * 12 : p.price_month);
  const out = await provider.createCheckout({ userId: input.userId, email: input.email, name: input.name, plan: church.plan_id as never, cycle: input.cycle, method: input.method, trial: false, amountBrl: amount });
  await saveSub(db, provider.name, out.providerRef, input.userId, church.plan_id as PlanId, input.cycle, { ...NO_SUB, status: "expired" }); // no access until the first payment is confirmed
  await db.rpc("api_billing_church_link", { p_secret: billingSecret(), p_provider: provider.name, p_ref: out.providerRef, p_church: input.churchId });
  void now;
  return { ...out, amount, plan: church.plan_id };
}
