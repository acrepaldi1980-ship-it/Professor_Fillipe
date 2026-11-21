// POST /api/v1/sessions { mode, topic? } -> { sessionId } (spec 10.5).
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { enforceLimit, requireFeature } from "@/lib/entitlements/guard";
import { getPath } from "@/lib/paths/data";
import { DeepContext, LessonContext, SermonContext } from "@/lib/modes/schema";

export const runtime = "nodejs";
const body = z.object({ mode: z.enum(["free", "lesson", "sermon", "deep", "rehearsal", "review"]).default("free"), topic: z.string().max(200).optional(), churchLessonId: z.string().uuid().optional(), pathId: z.string().max(40).optional(), pathDay: z.number().int().min(1).max(60).optional(), context: z.record(z.string(), z.unknown()).optional() });

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
    // A lesson published by the church: only a member of that class can open it (row level security on church_lessons). The lesson notes travel
    // in the session context so the teacher adapts the lesson to this student (level, age) without the class teacher ever seeing the talk.
    let churchLessonId: string | null = null;
    let lessonTopic: string | null = null;
    if (parsed.data.churchLessonId) {
      const { data: l } = await db.from("church_lessons").select("id, title, ref, notes").eq("id", parsed.data.churchLessonId).maybeSingle();
      if (!l) throw new HttpError(404, "lesson_not_found");
      churchLessonId = l.id;
      lessonTopic = l.title;
      context = { ...context, church_lesson: { title: l.title, ref: l.ref, notes: l.notes } };
    }
    // A day of a guided path: the teacher leads this day (passage and goal come from our own content, not from the request).
    if (parsed.data.pathId && parsed.data.pathDay) {
      const p = getPath(parsed.data.pathId);
      const day = p?.days.find((x) => x.day === parsed.data.pathDay);
      if (!p || !day) throw new HttpError(404, "path_not_found");
      context = { ...context, trail: { path: p.title, day: day.day, total: p.days.length, title: day.title, ref: day.ref, goal: day.goal } };
      lessonTopic = `${p.title}: dia ${day.day}, ${day.title}`;
    }
    const { data, error } = await db.from("sessions").insert({ user_id: user.id, mode: parsed.data.mode, topic: lessonTopic ?? topic, context, church_lesson_id: churchLessonId }).select("id").single();
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
