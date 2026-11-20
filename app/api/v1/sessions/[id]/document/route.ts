// GET -> the session's mode and its live document (lesson plan or sermon outline) with the gaps to fill.
// PUT {data} -> the student edits the document by hand (validated against the mode's schema).
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { LessonPlan, lessonGaps, SermonOutline, sermonGaps } from "@/lib/modes/schema";
import { loadSessionMode } from "@/lib/modes/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireUser(req);
    const { id } = await params;
    const sm = await loadSessionMode(db, id);
    if (!sm) throw new HttpError(404, "session_not_found");
    if (sm.mode === "lesson") {
      const { data } = await db.from("lesson_plans").select("data").eq("session_id", id).maybeSingle();
      const doc = LessonPlan.parse(data?.data ?? {});
      return Response.json({ mode: sm.mode, context: sm.context, doc, gaps: lessonGaps(doc) });
    }
    if (sm.mode === "sermon") {
      const { data } = await db.from("sermon_outlines").select("data").eq("session_id", id).maybeSingle();
      const doc = SermonOutline.parse(data?.data ?? {});
      return Response.json({ mode: sm.mode, context: sm.context, doc, gaps: sermonGaps(doc) });
    }
    return Response.json({ mode: sm.mode, context: sm.context, doc: null, gaps: [] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, db } = await requireUser(req);
    const { id } = await params;
    const sm = await loadSessionMode(db, id);
    if (!sm) throw new HttpError(404, "session_not_found");
    const body = (await req.json().catch(() => null)) as { data?: unknown; patch?: Record<string, unknown> } | null;
    const schema = sm.mode === "lesson" ? LessonPlan : sm.mode === "sermon" ? SermonOutline : null;
    if (!schema) throw new HttpError(400, "mode_has_no_document");
    const table = sm.mode === "lesson" ? "lesson_plans" : "sermon_outlines";
    const { data: row } = await db.from(table).select("id, data").eq("session_id", id).maybeSingle();
    // `patch` changes only some fields of what is stored (so a slow screen never overwrites the rest); `data` replaces everything.
    const candidate = body?.patch ? { ...((row?.data as Record<string, unknown> | undefined) ?? {}), ...body.patch } : body?.data;
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) throw new HttpError(400, "invalid_document");
    const { error } = await db.from(table).upsert({ ...(row ? { id: row.id } : {}), user_id: user.id, session_id: id, data: parsed.data }, { onConflict: "id" });
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
