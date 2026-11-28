// Builds (or changes) ONE section of the session's document with deep research: the Bible text, the original words, the library and
// other traditions are gathered once per session (research.ts) and are the only ground the model may use (RA-09).
import type { SupabaseClient } from "@supabase/supabase-js";
import { LANG_INFO, toLang, type Lang } from "../i18n/languages";
import { readLenses } from "../auth/preferences";
import { addUsage } from "../entitlements/guard";
import { getStore } from "../knowledge/db";
import { DeepStudy, deepGaps, LessonPlan, lessonGapKeys, lessonGaps, SermonOutline, sermonGapKeys, sermonGaps } from "./schema";
import { abntReference } from "../knowledge/abnt";
import { crossReferencesFor, gatherHistory, gatherResearch, historySources, sourcesFor } from "./research";
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

/** Added to the instructions of every document section for a student who studies in English, Spanish or Italian. */
export const languageDoc = (lang: Lang) => lang === "pt-BR" ? "" : `\n\nIDIOMA: o aluno estuda em ${LANG_INFO[lang].promptName}. Escreva TODO o conteúdo textual do documento em ${LANG_INFO[lang].promptName} (títulos, resumos, perguntas, ilustrações, explicações, aplicação). Mantenha as chaves do JSON e as referências bíblicas (como ACT.8.30) exatamente como pedido. Não traduza nomes de obras nem de autores.`;
export const SPANISH_DOC = languageDoc("es");

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
  // a Spanish-speaking student gets the document written in Spanish (Prompt 2.7)
  const { data: prof } = await db.from("profiles").select("locale").eq("user_id", userId).maybeSingle();
  const docLang = toLang(prof?.locale);
  const llm: typeof callJsonLlm = docLang !== "pt-BR" ? (system, user) => callJsonLlm(system + languageDoc(docLang), user) : callJsonLlm;

  let nextDoc: Record<string, unknown> | null = null;
  if (deterministic) {
    if (!research) throw new BuildError(422, "suggestion_not_usable");
    if (section === "crossrefs") {
      const refs = await crossReferencesFor(research.refs);
      nextDoc = refs.length ? { ...doc, crossrefs: refs } : null;
    } else {
      // ABNT list of every work the study used (excerpts and history), alphabetical
      const seen = new Map<string, { work: string; tradition?: string }>();
      const history = await gatherHistory(db, sm.id, sm.context).catch(() => []);
      for (const e of [...research.excerpts, ...history]) if (!seen.has(e.workId)) seen.set(e.workId, { work: abntReference({ title: e.work, authors: e.authors, pub_year: e.year, source_url: e.url, translators: e.translators }), tradition: e.tradition });
      const list = [...seen.values()].sort((a, b) => a.work.localeCompare(b.work, "pt-BR"));
      nextDoc = list.length ? { ...doc, bibliography: list } : null;
    }
  } else {
    const typeDef = mode === "sermon" ? await sermonTypeDefinition(db, sm.context.sermon_type) : undefined;
    const history = mode === "deep" && section === "history" ? await gatherHistory(db, sm.id, sm.context).catch(() => []) : undefined;
    try {
      const attempt = () => suggestSection(
        { mode, context: sm.context, doc, section, sermonTypeDefinition: typeDef, sources: history ? historySources(history) : research ? sourcesFor(research, section) : "", history, instruction, words: research?.words, excerpts: research?.excerpts },
        llm,
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
  // Several sections are written at the same time (in parallel on different AIs): only the keys this call changed are merged into the
  // latest stored document, with an optimistic check so two writers never overwrite each other.
  const changed = Object.fromEntries(Object.entries(nextDoc).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((doc as Record<string, unknown>)[k])));
  let saved: Record<string, unknown> = nextDoc;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: cur } = await db.from(table).select("id, data, updated_at").eq("session_id", sm.id).maybeSingle();
    if (!cur) {
      const { error } = await db.from(table).insert({ user_id: userId, session_id: sm.id, data: nextDoc });
      if (!error) break;
      if (attempt === 4) throw new BuildError(500, "save_failed");
      continue;
    }
    saved = { ...((cur.data as Record<string, unknown>) ?? {}), ...changed };
    const { data: upd, error } = await db.from(table).update({ data: saved, updated_at: new Date().toISOString() }).eq("id", cur.id).eq("updated_at", cur.updated_at).select("id");
    if (error) throw new BuildError(500, "save_failed");
    if (upd && upd.length) break;
    if (attempt === 4) throw new BuildError(409, "save_conflict");
  }
  nextDoc = saved;
  if (!deterministic) void addUsage(db, "text_messages", 1);
  return describeDoc(mode, nextDoc);
}
