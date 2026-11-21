// POST /api/v1/events { event, props } -> client-side analytics events (e.g. a visual opened). Allow-listed names only.
import { z } from "zod";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { EVENTS, track } from "@/lib/analytics/track";

export const runtime = "nodejs";
const body = z.object({ event: z.enum(EVENTS), props: z.record(z.string(), z.union([z.string().max(40), z.number(), z.boolean()])).optional() });

export async function POST(req: Request) {
  try {
    const { db, user } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:events`, LIMITS.events);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    track(db, parsed.data.event, parsed.data.props ?? {});
    return Response.json({ ok: true }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
