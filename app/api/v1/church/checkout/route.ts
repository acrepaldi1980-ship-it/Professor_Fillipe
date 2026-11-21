// POST /api/v1/church/checkout { churchId, cycle, method } -> { checkoutUrl, amount }: the church administrator pays the church plan.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { startChurchCheckout } from "@/lib/payments/service";

export const runtime = "nodejs";
export const maxDuration = 30;
const body = z.object({ churchId: z.string().uuid(), cycle: z.enum(["month", "year"]), method: z.enum(["pix", "card", "boleto"]) });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data: prof } = await db.from("profiles").select("display_name, preferred_name").eq("user_id", user.id).maybeSingle();
    try {
      const r = await startChurchCheckout(db, { userId: user.id, email: user.email ?? "", name: prof?.preferred_name || prof?.display_name || "Responsável", ...parsed.data });
      return Response.json({ checkoutUrl: r.checkoutUrl, amount: r.amount, plan: r.plan });
    } catch (e) {
      if ((e as Error).message === "forbidden") throw new HttpError(403, "forbidden");
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
