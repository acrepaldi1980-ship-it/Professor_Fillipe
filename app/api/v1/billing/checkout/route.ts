// POST /api/v1/billing/checkout { plan, cycle, method } -> { checkoutUrl, trial }: creates the subscription at the provider.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { loadAccess } from "@/lib/entitlements/server";
import { startCheckout } from "@/lib/payments/service";

export const runtime = "nodejs";
export const maxDuration = 30;
const body = z.object({ plan: z.enum(["plus", "premium"]), cycle: z.enum(["month", "year"]), method: z.enum(["pix", "card", "boleto"]) });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    // a minor needs a guardian to subscribe (D-08)
    const { data: prof } = await db.from("profiles").select("is_minor, display_name, preferred_name").eq("user_id", user.id).maybeSingle();
    if (prof?.is_minor) throw new HttpError(403, "minor_needs_guardian");
    const access = await loadAccess(db, user.id);
    if (access.plan === parsed.data.plan) throw new HttpError(409, "already_subscribed");
    const r = await startCheckout(db, { userId: user.id, email: user.email ?? "", name: prof?.preferred_name || prof?.display_name || "Aluno", ...parsed.data });
    return Response.json({ checkoutUrl: r.checkoutUrl, trial: r.trial, amount: r.amount });
  } catch (e) {
    return errorResponse(e);
  }
}
