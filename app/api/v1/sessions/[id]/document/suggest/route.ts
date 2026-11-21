// POST { section, index? } -> the teacher proposes ONE section of the lesson plan or the sermon outline and it is written into the document
// (the person edits it afterwards). Does not depend on the chat answer carrying `mode_payload`.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { LessonPlan, lessonGapKeys, lessonGaps, SermonOutline, sermonGapKeys, sermonGaps } from "@/lib/modes/schema";
import { loadSessionMode, sermonTypeDefinition, seedDocument } from "@/lib/modes/server";
import { callJsonLlm, isValidSection, suggestSection } from "@/lib/modes/suggest";
import { getStore } from "@/lib/knowledge/db";
import { findReferences } from "@/lib/knowledge/refs-parser";
import { getVerses, searchChunks } from "@/lib/knowledge/search";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { addUsage } from "@/lib/entitlements/guard";

export const runtime = "nodejs";
export const maxDuration = 60;
const body = z.object({ section: z.string().min(3).max(40) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, db } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:turn`, LIMITS.turn);
    const { id } = await params;
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const sm = await loadSessionMode(db, id);
    if (!sm) throw new HttpError(404, "session_not_found");
    if (sm.mode !== "lesson" && sm.mode !== "sermon") throw new HttpError(400, "mode_has_no_document");
    if (!isValidSection(sm.mode, parsed.data.section)) throw new HttpError(400, "invalid_section");
    const table = sm.mode === "lesson" ? "lesson_plans" : "sermon_outlines";
    const { data: row } = await db.from(table).select("id, data").eq("session_id", id).maybeSingle();
    const doc = { ...seedDocument(sm.mode, sm.context), ...((row?.data as Record<string, unknown> | undefined) ?? {}) };
    const typeDef = sm.mode === "sermon" ? await sermonTypeDefinition(db, sm.context.sermon_type) : undefined;
    // The only ground the model may use: the Bible passage of the setup (or, for a theme, the best excerpts of the library) (RA-09).
    let sources = "";
    try {
      const c = sm.context;
      const refs = findReferences(`${c.ref ?? ""} ${c.ref_or_theme ?? ""} ${c.topic ?? ""}`).flatMap((r) => r.refs).slice(0, 2);
      if (refs.length) {
        const verses = (await getVerses("por_blivre_2018", refs)).slice(0, 60);
        sources = verses.map((v) => `${v.ref.split(".").slice(1).join(":")} ${v.text}`).join("\n");
        if (sources) sources = `Texto bíblico (${refs.join("; ")}):\n${sources}`;
      }
      if (!sources) {
        const q = String(c.ref_or_theme ?? c.topic ?? "");
        if (q) sources = (await searchChunks(q, { maxTokens: 1500 })).chunks.slice(0, 4).map((x) => `[${x.title_path ?? ""}] ${x.text.slice(0, 700)}`).join("\n---\n");
      }
    } catch {
      sources = "";
    }
    let result;
    try {
      result = await suggestSection(
        { mode: sm.mode, context: sm.context, doc, section: parsed.data.section, sermonTypeDefinition: typeDef, sources },
        callJsonLlm,
        async (verse) => (await getStore().bibleVerses("por_blivre_2018", [verse], [])).length > 0,
      );
    } catch (e) {
      throw new HttpError(503, "suggestion_unavailable", { detail: String((e as Error).message).slice(0, 80) });
    }
    if (!result) throw new HttpError(422, "suggestion_not_usable");
    const { error } = await db.from(table).upsert({ ...(row ? { id: row.id } : {}), user_id: user.id, session_id: id, data: result.doc }, { onConflict: "id" });
    if (error) throw new HttpError(500, "save_failed");
    void addUsage(db, "text_messages", 1);
    const parsedDoc = sm.mode === "lesson" ? LessonPlan.parse(result.doc) : SermonOutline.parse(result.doc);
    return Response.json({
      ok: true,
      doc: parsedDoc,
      gaps: sm.mode === "lesson" ? lessonGaps(parsedDoc as LessonPlan) : sermonGaps(parsedDoc as SermonOutline),
      gapKeys: sm.mode === "lesson" ? lessonGapKeys(parsedDoc as LessonPlan) : sermonGapKeys(parsedDoc as SermonOutline),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
