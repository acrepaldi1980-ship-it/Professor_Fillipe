// POST /api/v1/sessions { mode, topic? } -> { sessionId } (spec 10.5).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { DeepContext, LessonContext, SermonContext } from "@/lib/modes/schema";

export const runtime = "nodejs";
const body = z.object({ mode: z.enum(["free", "lesson", "sermon", "deep", "rehearsal", "review"]).default("free"), topic: z.string().max(200).optional(), context: z.record(z.string(), z.unknown()).optional() });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
    // Each guided mode has its own setup, validated here (age group and minutes for a lesson, type for a sermon, passage for Aprofundar).
    let context: Record<string, unknown> = {};
    if (parsed.data.mode !== "free") {
      const schema = parsed.data.mode === "lesson" ? LessonContext : parsed.data.mode === "sermon" ? SermonContext : parsed.data.mode === "deep" ? DeepContext : null;
      if (schema) {
        const c = schema.safeParse(parsed.data.context);
        if (!c.success) throw new HttpError(400, "invalid_context");
        context = c.data as Record<string, unknown>;
      }
    }
    const topic = parsed.data.topic ?? (context.topic as string | undefined) ?? (context.ref_or_theme as string | undefined) ?? (context.ref as string | undefined) ?? null;
    const { data, error } = await db.from("sessions").insert({ user_id: user.id, mode: parsed.data.mode, topic, context }).select("id").single();
    if (error || !data) throw new HttpError(500, "session_failed");
    return Response.json({ sessionId: data.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
