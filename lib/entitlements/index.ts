// Access rights (spec 10.6.4): the app NEVER asks "did the user pay at Asaas?"; it asks "does the user have right X?" of the
// `entitlements` table. Whatever source grants a right (Asaas, Apple, Google, a church, an admin) is invisible to the screens.
export type PlanId = "free" | "plus" | "premium";
export type EntitlementSource = "asaas" | "apple" | "google" | "church" | "admin";

export interface EntitlementRow {
  entitlement: string; // "plan:plus", "plan:premium"
  source: EntitlementSource;
  status: "active" | "expired" | "revoked";
  expires_at: string | null;
}

export interface PlanRow {
  id: PlanId;
  name: string;
  price_month: number | string;
  price_year: number | string | null;
  limits: Record<string, number | null>;
  features: Record<string, boolean | string | number>;
}

const RANK: Record<PlanId, number> = { free: 0, plus: 1, premium: 2 };

/** The best plan among the active, not yet expired rights. */
export function planFromEntitlements(rows: EntitlementRow[], now = new Date()): PlanId {
  let best: PlanId = "free";
  for (const r of rows) {
    if (r.status !== "active") continue;
    if (r.expires_at && new Date(r.expires_at).getTime() <= now.getTime()) continue;
    const m = /^plan:(plus|premium)$/.exec(r.entitlement);
    if (m && RANK[m[1] as PlanId] > RANK[best]) best = m[1] as PlanId;
  }
  return best;
}

export interface Access {
  plan: PlanId;
  limits: Record<string, number | null>;
  features: Record<string, boolean | string | number>;
}

export function accessFor(plan: PlanId, plans: PlanRow[]): Access {
  const p = plans.find((x) => x.id === plan) ?? plans.find((x) => x.id === "free");
  return { plan, limits: p?.limits ?? {}, features: p?.features ?? {} };
}

export type Feature = "sermon" | "pdf_export" | "deepen_full";
export function can(access: Access, feature: Feature): boolean {
  if (feature === "deepen_full") return access.features.deepen === "full";
  return access.features[feature] === true;
}

/** Limits (null = unlimited, "fair use" applies elsewhere). */
export type LimitKind = "text_messages_day" | "voice_minutes_day" | "illustrations_day" | "lessons_month" | "deepen_month";
export interface Usage {
  text_messages_day: number;
  voice_minutes_day: number;
  illustrations_day: number;
  lessons_month: number;
  deepen_month: number;
}
export function checkLimit(access: Access, usage: Partial<Usage>, kind: LimitKind): { ok: boolean; limit: number | null; used: number } {
  const limit = access.limits[kind] ?? null;
  const used = usage[kind] ?? 0;
  return { ok: limit === null || used < limit, limit, used };
}

/** Fair use (8.12): a paid student far above the normal use is moved to the fast model and told so. */
export const FAIR_USE_MESSAGES_DAY = 150;
export const overFairUse = (access: Access, messagesToday: number) => access.plan !== "free" && messagesToday >= FAIR_USE_MESSAGES_DAY;
