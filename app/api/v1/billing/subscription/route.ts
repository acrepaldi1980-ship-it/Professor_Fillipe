// GET /api/v1/billing/subscription -> "Minha assinatura": plan, status, next charge, usage against the limits.
import { errorResponse, requireUser } from "@/lib/auth/server";
import { loadAccess, loadUsage } from "@/lib/entitlements/server";
import { rowToSub } from "@/lib/payments/service";
import { hasPaidAccess, tick } from "@/lib/payments/state";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const now = new Date();
    const [access, usage, { data: rows }] = await Promise.all([
      loadAccess(db, user.id, now),
      loadUsage(db, user.id),
      db.from("subscriptions").select("plan_id, status, cycle, current_period_end, trial_end, canceled_at, overdue_since, provider").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]);
    const row = rows?.[0];
    const sub = row ? tick(rowToSub(row), now) : null;
    return Response.json({
      plan: access.plan,
      limits: access.limits,
      features: access.features,
      usage,
      subscription: row && sub?.status && row.status !== "expired" ? { plan: row.plan_id, status: sub.status, cycle: row.cycle, periodEnd: row.current_period_end, trialEnd: row.trial_end, canceledAt: row.canceled_at, paidAccess: hasPaidAccess(sub, now) } : null,
      trialEligible: !rows?.length,
      provider: process.env.PAYMENT_PROVIDER ?? "simulated",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
