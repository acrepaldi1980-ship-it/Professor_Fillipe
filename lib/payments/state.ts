// Subscription state machine (spec 8.12): trialing -> active -> past_due (5 days of grace, access kept) -> suspended (back to Free)
// -> canceled (access until the end of the paid period) -> expired. Pure functions: every transition is tested.
export type SubStatus = "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";
export const GRACE_DAYS = 5;
export const TRIAL_DAYS = 7;
const DAY = 86_400_000;

export interface Sub {
  status: SubStatus | null; // null = no subscription yet
  periodEnd: Date | null; // end of the paid period (or of the trial)
  trialEnd: Date | null;
  overdueSince: Date | null;
  canceledAt: Date | null;
}
export const NO_SUB: Sub = { status: null, periodEnd: null, trialEnd: null, overdueSince: null, canceledAt: null };

export type SubEvent =
  | { type: "trial_started"; at: Date; trialDays?: number }
  | { type: "payment_confirmed"; at: Date; periodEnd: Date }
  | { type: "payment_overdue"; at: Date }
  | { type: "cancel_requested"; at: Date }
  | { type: "subscription_deleted"; at: Date };

/** Applies an event that came from the provider or from the student. Unknown combinations leave the subscription as it is. */
export function transition(s: Sub, e: SubEvent): Sub {
  switch (e.type) {
    case "trial_started": {
      if (s.status !== null && s.status !== "expired" && s.status !== "suspended" && s.status !== "canceled") return s;
      const end = new Date(e.at.getTime() + (e.trialDays ?? TRIAL_DAYS) * DAY);
      return { status: "trialing", periodEnd: end, trialEnd: end, overdueSince: null, canceledAt: null };
    }
    case "payment_confirmed":
      // a confirmed payment always (re)activates: first payment, renewal, recovery from past_due/suspended, or a new subscription after canceling
      return { ...s, status: "active", periodEnd: e.periodEnd, overdueSince: null, canceledAt: null };
    case "payment_overdue":
      if (s.status === "active" || s.status === "trialing") return { ...s, status: "past_due", overdueSince: e.at };
      return s;
    case "cancel_requested":
      if (s.status === "active" || s.status === "trialing" || s.status === "past_due") return { ...s, status: "canceled", canceledAt: e.at };
      return s;
    case "subscription_deleted":
      if (s.status === null || s.status === "expired") return s;
      return s.periodEnd && s.periodEnd.getTime() > e.at.getTime() && s.status !== "suspended" ? { ...s, status: "canceled", canceledAt: s.canceledAt ?? e.at } : { ...s, status: "expired" };
  }
}

/** Time-based transitions, applied lazily whenever the subscription is read (and by a daily job when there is one). */
export function tick(s: Sub, now: Date): Sub {
  if (s.status === "past_due" && s.overdueSince && now.getTime() >= s.overdueSince.getTime() + GRACE_DAYS * DAY) return { ...s, status: "suspended" };
  if (s.status === "trialing" && s.periodEnd && now.getTime() >= s.periodEnd.getTime()) return { ...s, status: "expired" }; // trial ended without payment
  if (s.status === "canceled" && s.periodEnd && now.getTime() >= s.periodEnd.getTime()) return { ...s, status: "expired" };
  return s;
}

/** Does the subscription give paid access right now? (past_due keeps access during the grace period.) */
export function hasPaidAccess(s: Sub, now: Date): boolean {
  const t = tick(s, now);
  switch (t.status) {
    case "trialing":
    case "active":
    case "past_due":
      return true;
    case "canceled":
      return !!t.periodEnd && now.getTime() < t.periodEnd.getTime();
    default:
      return false;
  }
}

/** When the entitlement written for this subscription expires, so access also ends on its own if no event arrives. */
export function entitlementExpiry(s: Sub): Date | null {
  if (!s.periodEnd) return null;
  if (s.status === "past_due" && s.overdueSince) return new Date(s.overdueSince.getTime() + GRACE_DAYS * DAY);
  // a few hours of slack after the period end so a renewal webhook that is a little late does not cut the access
  return new Date(s.periodEnd.getTime() + (s.status === "active" ? 12 * 3600_000 : 0));
}
