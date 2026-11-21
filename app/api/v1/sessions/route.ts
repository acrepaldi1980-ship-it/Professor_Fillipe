// POST /api/v1/sessions { mode, topic? } -> { sessionId } (spec 10.5).
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { enforceLimit, requireFeature } from "@/lib/entitlements/guard";
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
    // Plan rules: sermons are Premium; free students have 1 lesson and 3 deepenings per month.
    if (parsed.data.mode === "sermon") await requireFeature(db, user.id, "sermon");
    if (parsed.data.mode === "lesson") await enforceLimit(db, user.id, "lessons_month");
    if (parsed.data.mode === "deep") await enforceLimit(db, user.id, "deepen_month");
    const { data, error } = await db.from("sessions").insert({ user_id: user.id, mode: parsed.data.mode, topic, context }).select("id").single();
    if (error || !data) throw new HttpError(500, "session_failed");
    track(db, "session_started", { mode: parsed.data.mode });
    return Response.json({ sessionId: data.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

// GET /api/v1/sessions?limit=5 -> the student's latest sessions (for "Continuar de onde parei").
export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    const limit = Math.min(20, Number(new URL(req.url).searchParams.get("limit")) || 5);
    const { data } = await db.from("sessions").select("id, mode, topic, started_at, ended_at").order("started_at", { ascending: false }).limit(limit);
    return Response.json({ sessions: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
