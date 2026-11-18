// POST /api/v1/sessions { mode, topic? } -> { sessionId } (spec 10.5).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";
const body = z.object({ mode: z.enum(["free", "lesson", "sermon", "deep", "rehearsal", "review"]).default("free"), topic: z.string().max(200).optional() });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
    const { data, error } = await db.from("sessions").insert({ user_id: user.id, mode: parsed.data.mode, topic: parsed.data.topic ?? null }).select("id").single();
    if (error || !data) throw new HttpError(500, "session_failed");
    return Response.json({ sessionId: data.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
