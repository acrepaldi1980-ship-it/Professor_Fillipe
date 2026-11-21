import { describe, expect, it } from "vitest";
import { entitlementExpiry, GRACE_DAYS, hasPaidAccess, NO_SUB, tick, transition, type Sub } from "../../lib/payments/state";

const D = 86_400_000;
const t0 = new Date("2026-11-21T12:00:00Z");
const plus = (days: number, from = t0) => new Date(from.getTime() + days * D);
const active = (end = plus(30)): Sub => transition(NO_SUB, { type: "payment_confirmed", at: t0, periodEnd: end });

describe("subscription state machine", () => {
  it("none -> trialing for 7 days (Premium trial)", () => {
    const s = transition(NO_SUB, { type: "trial_started", at: t0 });
    expect(s.status).toBe("trialing");
    expect(s.trialEnd).toEqual(plus(7));
    expect(hasPaidAccess(s, plus(6))).toBe(true);
  });
  it("trialing -> active when the first payment is confirmed", () => {
    const s = transition(transition(NO_SUB, { type: "trial_started", at: t0 }), { type: "payment_confirmed", at: plus(3), periodEnd: plus(33) });
    expect(s.status).toBe("active");
    expect(s.periodEnd).toEqual(plus(33));
  });
  it("trialing -> expired when the trial ends without payment", () => {
    const s = transition(NO_SUB, { type: "trial_started", at: t0 });
    expect(tick(s, plus(7.01)).status).toBe("expired");
    expect(hasPaidAccess(s, plus(8))).toBe(false);
  });
  it("none -> active on a confirmed payment, and a renewal extends the period", () => {
    const s = active(plus(30));
    expect(s.status).toBe("active");
    const r = transition(s, { type: "payment_confirmed", at: plus(30), periodEnd: plus(60) });
    expect(r.status).toBe("active");
    expect(r.periodEnd).toEqual(plus(60));
  });
  it("active -> past_due keeps access during the 5 days of grace", () => {
    const s = transition(active(), { type: "payment_overdue", at: plus(30) });
    expect(s.status).toBe("past_due");
    expect(hasPaidAccess(s, plus(30 + GRACE_DAYS - 0.1))).toBe(true);
  });
  it("past_due -> suspended after the grace period, and access ends (back to Free)", () => {
    const s = transition(active(), { type: "payment_overdue", at: plus(30) });
    expect(tick(s, plus(30 + GRACE_DAYS)).status).toBe("suspended");
    expect(hasPaidAccess(s, plus(30 + GRACE_DAYS + 0.1))).toBe(false);
  });
  it("past_due -> active when the late payment arrives; suspended -> active too", () => {
    const late = transition(active(), { type: "payment_overdue", at: plus(30) });
    expect(transition(late, { type: "payment_confirmed", at: plus(32), periodEnd: plus(62) }).status).toBe("active");
    const susp = tick(late, plus(40));
    expect(susp.status).toBe("suspended");
    expect(transition(susp, { type: "payment_confirmed", at: plus(41), periodEnd: plus(71) }).status).toBe("active");
  });
  it("active -> canceled keeps access until the end of the paid period, then expired", () => {
    const s = transition(active(plus(30)), { type: "cancel_requested", at: plus(10) });
    expect(s.status).toBe("canceled");
    expect(s.canceledAt).toEqual(plus(10));
    expect(hasPaidAccess(s, plus(29))).toBe(true);
    expect(tick(s, plus(30)).status).toBe("expired");
    expect(hasPaidAccess(s, plus(31))).toBe(false);
  });
  it("canceled -> active when the student subscribes again", () => {
    const s = transition(active(plus(30)), { type: "cancel_requested", at: plus(10) });
    const again = transition(s, { type: "payment_confirmed", at: plus(12), periodEnd: plus(42) });
    expect(again.status).toBe("active");
    expect(again.canceledAt).toBeNull();
  });
  it("a deleted subscription cancels (before the period ends) or expires (after)", () => {
    expect(transition(active(plus(30)), { type: "subscription_deleted", at: plus(5) }).status).toBe("canceled");
    expect(transition(active(plus(30)), { type: "subscription_deleted", at: plus(31) }).status).toBe("expired");
  });
  it("irrelevant events do nothing (overdue on a canceled one, cancel with no subscription)", () => {
    const c = transition(active(), { type: "cancel_requested", at: plus(1) });
    expect(transition(c, { type: "payment_overdue", at: plus(2) })).toEqual(c);
    expect(transition(NO_SUB, { type: "cancel_requested", at: t0 })).toEqual(NO_SUB);
    expect(transition(NO_SUB, { type: "payment_overdue", at: t0 })).toEqual(NO_SUB);
  });
  it("a new trial is allowed again only after expiry, never during an active subscription", () => {
    expect(transition(active(), { type: "trial_started", at: plus(1) }).status).toBe("active");
  });
  it("entitlement expiry: period end + slack when active, end of the grace when past_due, exact end when canceled", () => {
    const a = active(plus(30));
    expect(entitlementExpiry(a)!.getTime()).toBeGreaterThan(plus(30).getTime());
    const p = transition(a, { type: "payment_overdue", at: plus(30) });
    expect(entitlementExpiry(p)).toEqual(plus(30 + GRACE_DAYS));
    expect(entitlementExpiry(transition(a, { type: "cancel_requested", at: plus(2) }))).toEqual(plus(30));
  });
});
