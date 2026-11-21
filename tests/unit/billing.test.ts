import { beforeEach, describe, expect, it } from "vitest";
import { accessFor, can, checkLimit, overFairUse, planFromEntitlements, type EntitlementRow, type PlanRow } from "../../lib/entitlements";
import { costBrl } from "../../lib/entitlements/guard";
import { applyEvent } from "../../lib/payments/service";
import { SimulatedProvider, SIM_TOKEN_HEADER, simToken } from "../../lib/payments/simulated";
import { AsaasProvider } from "../../lib/payments/asaas";

const PLANS: PlanRow[] = [
  { id: "free", name: "Grátis", price_month: 0, price_year: null, limits: { voice_minutes_day: 15, text_messages_day: 20, illustrations_day: 2, lessons_month: 1, deepen_month: 3 }, features: { sermon: false, pdf_export: false, deepen: "basic" } },
  { id: "plus", name: "Plus", price_month: 29.9, price_year: 287, limits: { voice_minutes_day: 120, text_messages_day: null, illustrations_day: 10, lessons_month: null, deepen_month: null }, features: { sermon: false, pdf_export: true, deepen: "basic" } },
  { id: "premium", name: "Premium", price_month: 49.9, price_year: 479, limits: { voice_minutes_day: 240, text_messages_day: null, illustrations_day: 30, lessons_month: null, deepen_month: null }, features: { sermon: true, pdf_export: true, deepen: "full", trial_days: 7 } },
];
const now = new Date("2026-11-21T12:00:00Z");
const ent = (entitlement: string, source: EntitlementRow["source"], expires: string | null, status: EntitlementRow["status"] = "active"): EntitlementRow => ({ entitlement, source, status, expires_at: expires });

describe("entitlements: the only source of plan decisions", () => {
  it("no rights = Free; the best active, unexpired right wins", () => {
    expect(planFromEntitlements([], now)).toBe("free");
    expect(planFromEntitlements([ent("plan:plus", "asaas", "2026-12-01T00:00:00Z")], now)).toBe("plus");
    expect(planFromEntitlements([ent("plan:plus", "asaas", "2026-12-01T00:00:00Z"), ent("plan:premium", "admin", null)], now)).toBe("premium");
  });
  it("expired and revoked rights do not count", () => {
    expect(planFromEntitlements([ent("plan:premium", "asaas", "2026-11-20T00:00:00Z")], now)).toBe("free");
    expect(planFromEntitlements([ent("plan:premium", "asaas", null, "revoked")], now)).toBe("free");
  });
  it("PROOF: a right written by an \"apple\" source opens the access with no change anywhere else", () => {
    const rows = [ent("plan:premium", "apple", "2026-12-21T00:00:00Z")];
    const access = accessFor(planFromEntitlements(rows, now), PLANS);
    expect(access.plan).toBe("premium");
    expect(can(access, "sermon")).toBe(true);
    expect(can(access, "pdf_export")).toBe(true);
    expect(can(access, "deepen_full")).toBe(true);
  });
  it("features by plan: sermon only Premium, PDF from Plus", () => {
    const free = accessFor("free", PLANS), plus = accessFor("plus", PLANS), prem = accessFor("premium", PLANS);
    expect([can(free, "sermon"), can(plus, "sermon"), can(prem, "sermon")]).toEqual([false, false, true]);
    expect([can(free, "pdf_export"), can(plus, "pdf_export"), can(prem, "pdf_export")]).toEqual([false, true, true]);
    expect([can(free, "deepen_full"), can(plus, "deepen_full"), can(prem, "deepen_full")]).toEqual([false, false, true]);
  });
  it("limits: Free stops at 20 messages, 1 lesson and 3 deepenings; Plus has no message limit", () => {
    const free = accessFor("free", PLANS), plus = accessFor("plus", PLANS);
    expect(checkLimit(free, { text_messages_day: 19 }, "text_messages_day").ok).toBe(true);
    expect(checkLimit(free, { text_messages_day: 20 }, "text_messages_day")).toMatchObject({ ok: false, limit: 20, used: 20 });
    expect(checkLimit(free, { lessons_month: 1 }, "lessons_month").ok).toBe(false);
    expect(checkLimit(free, { deepen_month: 3 }, "deepen_month").ok).toBe(false);
    expect(checkLimit(free, { voice_minutes_day: 15 }, "voice_minutes_day").ok).toBe(false);
    expect(checkLimit(plus, { text_messages_day: 5000 }, "text_messages_day").ok).toBe(true);
    expect(checkLimit(plus, { illustrations_day: 10 }, "illustrations_day").ok).toBe(false);
  });
  it("fair use applies to paid plans only", () => {
    expect(overFairUse(accessFor("plus", PLANS), 149)).toBe(false);
    expect(overFairUse(accessFor("plus", PLANS), 150)).toBe(true);
    expect(overFairUse(accessFor("free", PLANS), 500)).toBe(false);
  });
  it("estimates the cost of an answer in BRL", () => {
    expect(costBrl({ input: 3000, output: 700, cacheRead: 0, cacheWrite: 2500 })).toBeGreaterThan(0.03);
    expect(costBrl(undefined)).toBe(0);
  });
});

// ---- webhook processing against an in-memory fake of the database functions ----
type Row = { id: string; user_id: string; plan_id: string; status: string; current_period_end: string | null; trial_end: string | null; canceled_at: string | null; cycle: string; overdue_since: string | null };
function fakeDb() {
  const SECRET = "test-secret"; // what the database knows
  const events = new Set<string>();
  const subs = new Map<string, Row>();
  const rights = new Map<string, { status: string; expires: string | null; source: string }>();
  const processed: string[] = [];
  const db = {
    async rpc(name: string, a: Record<string, unknown>) {
      if (a.p_secret !== SECRET) return { data: null, error: { message: "forbidden" } };
      switch (name) {
        case "api_billing_event": { const fresh = !events.has(a.p_key as string); events.add(a.p_key as string); return { data: fresh, error: null }; }
        case "api_billing_find_subscription": { const r = subs.get(a.p_ref as string); return { data: r ? [r] : [], error: null }; }
        case "api_billing_subscription": subs.set(a.p_ref as string, { id: "s1", user_id: a.p_user as string, plan_id: a.p_plan as string, status: a.p_status as string, current_period_end: a.p_period_end as string | null, trial_end: a.p_trial_end as string | null, canceled_at: a.p_canceled_at as string | null, cycle: a.p_cycle as string, overdue_since: a.p_overdue_since as string | null }); return { data: "s1", error: null };
        case "api_entitlement_grant": rights.set(`${a.p_user}|${a.p_entitlement}|${a.p_source}`, { status: "active", expires: a.p_expires as string | null, source: a.p_source as string }); return { data: null, error: null };
        case "api_entitlement_revoke": { const k = `${a.p_user}|${a.p_entitlement}|${a.p_source}`; const r = rights.get(k); if (r) r.status = "revoked"; return { data: null, error: null }; }
        case "api_billing_processed": processed.push(a.p_key as string); return { data: null, error: null };
      }
      return { data: null, error: { message: "unknown" } };
    },
  };
  return { db: db as never, events, subs, rights, processed };
}
const hook = (event: string, ref: string, id: string, at: Date = now) => new SimulatedProvider().parseWebhook(new Headers({ [SIM_TOKEN_HEADER]: simToken() }), JSON.stringify({ id, event, ref, at: at.toISOString() }))!;
const seed = (f: ReturnType<typeof fakeDb>, status = "expired", end: string | null = null) => f.subs.set("sim_1", { id: "s1", user_id: "u1", plan_id: "plus", status, current_period_end: end, trial_end: null, canceled_at: null, cycle: "month", overdue_since: null });

describe("payment webhooks", () => {
  beforeEach(() => { process.env.BILLING_SERVER_SECRET = "test-secret"; process.env.PAYMENT_WEBHOOK_TOKEN = "hook-token"; });

  it("rejects a webhook with a wrong or missing token", () => {
    const p = new SimulatedProvider();
    expect(p.parseWebhook(new Headers(), "{}")).toBeNull();
    expect(p.parseWebhook(new Headers({ [SIM_TOKEN_HEADER]: "wrong" }), '{"id":"1","event":"PAYMENT_CONFIRMED","ref":"sim_1"}')).toBeNull();
    const a = new AsaasProvider();
    expect(a.parseWebhook(new Headers({ "asaas-access-token": "nope" }), '{"event":"PAYMENT_CONFIRMED","payment":{"id":"p","subscription":"sub_1"}}')).toBeNull();
    expect(a.parseWebhook(new Headers({ "asaas-access-token": "hook-token" }), '{"id":"e1","event":"PAYMENT_CONFIRMED","payment":{"id":"p","subscription":"sub_1"}}')?.type).toBe("payment_confirmed");
    expect(a.parseWebhook(new Headers({ "asaas-access-token": "hook-token" }), '{"id":"e2","event":"PAYMENT_OVERDUE","payment":{"id":"p","subscription":"sub_1"}}')?.type).toBe("payment_overdue");
  });

  it("payment confirmed: activates the subscription and grants the access right", async () => {
    const f = fakeDb(); seed(f);
    expect(await applyEvent(hook("PAYMENT_CONFIRMED", "sim_1", "e1"), "simulated", f.db, now)).toBe("applied");
    expect(f.subs.get("sim_1")!.status).toBe("active");
    expect(f.rights.get("u1|plan:plus|admin")).toMatchObject({ status: "active" });
    expect(new Date(f.subs.get("sim_1")!.current_period_end!).getTime()).toBeGreaterThan(now.getTime() + 29 * 86_400_000);
    expect(f.processed).toContain("simulated:e1");
  });

  it("is idempotent: the same event delivered twice changes nothing the second time", async () => {
    const f = fakeDb(); seed(f);
    await applyEvent(hook("PAYMENT_CONFIRMED", "sim_1", "e1"), "simulated", f.db, now);
    const end1 = f.subs.get("sim_1")!.current_period_end;
    expect(await applyEvent(hook("PAYMENT_CONFIRMED", "sim_1", "e1"), "simulated", f.db, now)).toBe("duplicate");
    expect(f.subs.get("sim_1")!.current_period_end).toBe(end1);
  });

  it("overdue: past_due keeps the right (5 days of grace); after the grace the access ends", async () => {
    const f = fakeDb(); seed(f, "active", "2026-12-01T00:00:00Z");
    await applyEvent(hook("PAYMENT_OVERDUE", "sim_1", "e2"), "simulated", f.db, now);
    expect(f.subs.get("sim_1")!.status).toBe("past_due");
    expect(f.rights.get("u1|plan:plus|admin")!.status).toBe("active");
    const exp = new Date(f.rights.get("u1|plan:plus|admin")!.expires!);
    expect(exp.getTime()).toBe(now.getTime() + 5 * 86_400_000);
    // 6 days later any event re-reads the subscription: the grace is over -> suspended -> the right is revoked
    const later = new Date(now.getTime() + 6 * 86_400_000);
    await applyEvent(hook("SUBSCRIPTION_DELETED", "sim_1", "e3", later), "simulated", f.db, later);
    expect(f.rights.get("u1|plan:plus|admin")!.status).toBe("revoked");
  });

  it("canceled: access stays until the end of the paid period", async () => {
    const f = fakeDb(); seed(f, "active", "2026-12-15T00:00:00Z");
    await applyEvent(hook("SUBSCRIPTION_DELETED", "sim_1", "e4"), "simulated", f.db, now);
    expect(f.subs.get("sim_1")!.status).toBe("canceled");
    expect(f.rights.get("u1|plan:plus|admin")).toMatchObject({ status: "active", expires: "2026-12-15T00:00:00.000Z" });
  });

  it("an event for an unknown subscription is logged and reported, never applied", async () => {
    const f = fakeDb();
    expect(await applyEvent(hook("PAYMENT_CONFIRMED", "sim_ghost", "e5"), "simulated", f.db, now)).toBe("unknown_subscription");
    expect(f.rights.size).toBe(0);
  });

  it("the database functions refuse a wrong server secret", async () => {
    const f = fakeDb(); seed(f);
    process.env.BILLING_SERVER_SECRET = "another";
    await expect(applyEvent(hook("PAYMENT_CONFIRMED", "sim_1", "e6"), "simulated", f.db, now)).rejects.toThrow();
  });
});
