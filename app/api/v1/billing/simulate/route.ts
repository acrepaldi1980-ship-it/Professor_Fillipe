// POST /api/v1/billing/simulate { ref, event } -> sandbox only (PAYMENT_PROVIDER=simulated): sends, as the student, the webhook a real
// provider would send for the student's OWN subscription (payment confirmed, overdue, canceled), through the same path as production.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { applyEvent } from "@/lib/payments/service";
import { SimulatedProvider, SIM_TOKEN_HEADER, simToken } from "@/lib/payments/simulated";

export const runtime = "nodejs";
export const maxDuration = 30;
const body = z.object({ ref: z.string().startsWith("sim_"), event: z.enum(["PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "SUBSCRIPTION_DELETED"]), days: z.number().min(0).max(400).optional() });

export async function POST(req: Request) {
  try {
    if ((process.env.PAYMENT_PROVIDER ?? "simulated") !== "simulated") throw new HttpError(404, "not_found");
    const { db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data: own } = await db.from("subscriptions").select("id").eq("provider", "simulated").eq("provider_ref", parsed.data.ref).maybeSingle();
    if (!own) throw new HttpError(404, "subscription_not_found"); // RLS: only the student's own subscription is visible
    const payload = JSON.stringify({ id: randomUUID(), event: parsed.data.event, ref: parsed.data.ref });
    const ev = new SimulatedProvider().parseWebhook(new Headers({ [SIM_TOKEN_HEADER]: simToken() }), payload);
    if (!ev) throw new HttpError(500, "simulation_failed");
    return Response.json({ ok: true, result: await applyEvent(ev, "simulated") });
  } catch (e) {
    return errorResponse(e);
  }
}
