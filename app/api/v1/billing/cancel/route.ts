// POST /api/v1/billing/cancel -> cancels the subscription; access stays until the end of the paid period.
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { track } from "@/lib/analytics/track";
import { cancelSubscription } from "@/lib/payments/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const ok = await cancelSubscription(db, user.id);
    if (!ok) throw new HttpError(404, "no_subscription");
    track(db, "subscription_canceled");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
