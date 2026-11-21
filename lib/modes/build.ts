// Builds (or changes) ONE section of the session's document with deep research: the Bible text, the original words, the library and
// other traditions are gathered once per session (research.ts) and are the only ground the model may use (RA-09).
import type { SupabaseClient } from "@supabase/supabase-js";
import { readLenses } from "../auth/preferences";
import { addUsage } from "../entitlements/guard";
import { getStore } from "../knowledge/db";
import { DeepStudy, deepGaps, LessonPlan, lessonGapKeys, lessonGaps, SermonOutline, sermonGapKeys, sermonGaps } from "./schema";
import { crossReferencesFor, gatherResearch } from "./research";
import { sermonTypeDefinition, seedDocument, type SessionMode } from "./server";
import { callJsonLlm, isValidSection, suggestSection } from "./suggest";

export const DOC_TABLE = { lesson: "lesson_plans", sermon: "sermon_outlines", deep: "deep_studies" } as const;
export type DocMode = keyof typeof DOC_TABLE;
export class BuildError extends Error { constructor(public status: number, public code: string, public extra?: Record<string, unknown>) { super(code); } }

export function describeDoc(mode: DocMode, doc: Record<string, unknown>) {
  if (mode === "lesson") { const d = LessonPlan.parse(doc); return { doc: d, gaps: lessonGaps(d), gapKeys: lessonGapKeys(d) }; }
  if (mode === "sermon") { const d = SermonOutline.parse(doc); return { doc: d, gaps: sermonGaps(d), gapKeys: sermonGapKeys(d) }; }
  const d = DeepStudy.parse(doc); const g = deepGaps(d); return { doc: d, gaps: g.map((x) => x.text), gapKeys: g.map((x) => x.key) };
}

export async function buildSection(db: SupabaseClient, userId: string, sm: SessionMode, section: string, instruction?: string) {
  const mode = sm.mode as DocMode;
  if (!(mode in DOC_TABLE)) throw new BuildError(400, "mode_has_no_document");
  const deterministic = mode === "deep" && (section === "crossrefs" || section === "bibliography");
  if (!deterministic && !isValidSection(mode, section)) throw new BuildError(400, "invalid_section");
  const table = DOC_TABLE[mode];
  const { data: row } = await db.from(table).select("id, data").eq("session_id", sm.id).maybeSingle();
  const doc = { ...seedDocument(mode, sm.context), ...((row?.data as Record<string, unknown> | undefined) ?? {}) };
  const lenses = await readLenses(db, userId).catch(() => [] as string[]);
  const research = await gatherResearch(db, sm.id, mode, sm.context, lenses).catch(() => null);

  let nextDoc: Record<string, unknown> | null = null;
  if (deterministic) {
    if (!research) throw new BuildError(422, "suggestion_not_usable");
    if (section === "crossrefs") {
      const refs = await crossReferencesFor(research.refs);
      nextDoc = refs.length ? { ...doc, crossrefs: refs } : null;
    } else {
      const seen = new Map<string, { work: string; tradition?: string }>();
      for (const e of research.excerpts) if (!seen.has(e.workId)) seen.set(e.workId, { work: `${e.work}${e.author ? `, ${e.author}` : ""}`, tradition: e.tradition });
      nextDoc = seen.size ? { ...doc, bibliography: [...seen.values()] } : null;
    }
  } else {
    const typeDef = mode === "sermon" ? await sermonTypeDefinition(db, sm.context.sermon_type) : undefined;
    try {
      const attempt = () => suggestSection(
        { mode, context: sm.context, doc, section, sermonTypeDefinition: typeDef, sources: research?.text ?? "", instruction, words: research?.words, excerpts: research?.excerpts },
        callJsonLlm,
        async (verse) => (await getStore().bibleVerses("por_blivre_2018", [verse], [])).length > 0,
      );
      // the model sometimes answers with nothing usable: one more try is cheap
      const result = (await attempt()) ?? (await attempt());
      nextDoc = result?.doc ?? null;
    } catch (e) {
      throw new BuildError(503, "suggestion_unavailable", { detail: String((e as Error).message).slice(0, 80) });
    }
  }
  if (!nextDoc) throw new BuildError(422, "suggestion_not_usable");
  const { error } = await db.from(table).upsert({ ...(row ? { id: row.id } : {}), user_id: userId, session_id: sm.id, data: nextDoc }, { onConflict: "id" });
  if (error) throw new BuildError(500, "save_failed");
  if (!deterministic) void addUsage(db, "text_messages", 1);
  return describeDoc(mode, nextDoc);
}
