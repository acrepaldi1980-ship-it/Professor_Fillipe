// Deep research for the guided modes (spec 8.18): before writing any section, the app gathers its ground truth once per session:
// the Bible text of the passage, the original words (Aprofundar) and the best excerpts of the library, including other traditions.
// Everything the model may use is in this bundle (RA-09); the same bundle serves every step of the document.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOriginalWords, type OriginalWord } from "../knowledge/original";
import { findReferences, formatRefPt } from "../knowledge/refs-parser";
import { refQuery } from "../knowledge/reference-db";
import { getVerses, searchChunks } from "../knowledge/search";

export interface Excerpt { id: string; workId: string; work: string; author: string; tradition: string; title: string; text: string; authors?: string[]; year?: number | null; url?: string | null; translators?: string[] | null }
export interface WordRef { id: string; surface: string; translit: string | null; lemma: string | null; strong: string | null; gloss: string | null; lexicon?: string }
export interface Research { refs: string[]; bible: string; words: WordRef[]; excerpts: Excerpt[]; text: string; at: number; topic: string }

const cache = new Map<string, Research>();
const TTL = 15 * 60_000;

export const LESSON_STEPS = ["context", "objective", "icebreaker", "points", "dynamic", "questions", "application", "memory_verse"];
export const SERMON_STEPS = ["central_idea", "introduction", "division", "division", "division", "conclusion", "appeal"];
export const DEEP_STEPS = ["overview", "context", "structure", "keywords", "traditions", "history", "application", "crossrefs", "bibliography"];

const pending = new Map<string, Promise<Research>>();

/** One research per session, shared by every section built at the same time (they run in parallel and must not repeat or overwrite each other). */
export function gatherResearch(db: SupabaseClient, sessionId: string, mode: string, ctx: Record<string, unknown>, lenses: string[]): Promise<Research> {
  const hit = cache.get(sessionId);
  // an empty library result is not kept for long (it may have been a slow moment): the next call tries again
  if (hit && Date.now() - hit.at < (hit.excerpts.length || !hit.topic ? TTL : 20_000)) return Promise.resolve(hit);
  const running = pending.get(sessionId);
  if (running) return running;
  const p = doGather(db, sessionId, mode, ctx, lenses).finally(() => pending.delete(sessionId));
  pending.set(sessionId, p);
  return p;
}

async function doGather(db: SupabaseClient, sessionId: string, mode: string, ctx: Record<string, unknown>, lenses: string[]): Promise<Research> {
  const topic = String(ctx.ref_or_theme ?? ctx.topic ?? ctx.ref ?? "");
  const refs = findReferences(`${ctx.ref ?? ""} ${ctx.ref_or_theme ?? ""} ${ctx.topic ?? ""}`).flatMap((r) => r.refs).slice(0, 2);

  let bible = "";
  if (refs.length) {
    const verses = (await getVerses("por_blivre_2018", refs).catch(() => [])).slice(0, 70);
    if (verses.length) bible = `Texto bíblico (${refs.map(formatRefPt).join("; ")}):\n` + verses.map((v) => `${v.ref.split(".").slice(1).join(":")} ${v.text}`).join("\n");
  }

  let words: WordRef[] = [];
  if (mode === "deep" && refs.length) {
    const raw: OriginalWord[] = await getOriginalWords(refs[0]).catch(() => []);
    const seen = new Set<string>();
    for (const w of raw) {
      if (!w.strong || seen.has(w.strong) || words.length >= 30) continue;
      seen.add(w.strong);
      words.push({ id: `w${words.length + 1}`, surface: w.surface, translit: w.translit, lemma: w.lemma, strong: w.strong, gloss: w.gloss, lexicon: w.lexicon });
    }
  }
  words = words.filter((w) => w.gloss || w.lexicon);

  // library: the best excerpts for the passage or theme, weighted toward the student's lenses and with other traditions for contrast
  let excerpts: Excerpt[] = [];
  if (topic) {
    const found = await searchChunks(topic, { lenses, maxTokens: 4500, maxBible: 1, maxChunks: 14, extraRefs: refs }).catch(() => ({ chunks: [], refs: [] as string[] }));
    // Bible versions and word lists are used elsewhere; here we want commentary, theology, history, notes and dictionaries
    const chunks = found.chunks.filter((c) => !["bible_text", "geodata", "lexicon"].includes(c.kind)).slice(0, 8);
    if (chunks.length) {
      const ids = [...new Set(chunks.map((c) => c.work_id))];
      const { data: works } = await db.from("works").select("id, title, authors, tradition, pub_year, source_url, translators").in("id", ids);
      const byId = new Map((works ?? []).map((w) => [w.id as string, w as { id: string; title: string; authors: string[] | null; tradition: string; pub_year: number | null; source_url: string | null; translators: string[] | null }]));
      excerpts = chunks.map((c, i) => {
        const w = byId.get(c.work_id);
        return { id: `e${i + 1}`, workId: c.work_id, work: w?.title ?? c.work_id, author: (w?.authors ?? []).join(", "), tradition: w?.tradition ?? c.tradition, title: c.title_path ?? "", text: c.text.slice(0, 900), authors: w?.authors ?? [], year: w?.pub_year ?? null, url: w?.source_url ?? null, translators: w?.translators ?? null };
      });
    }
  }

  const text = [
    bible,
    words.length ? "PALAVRAS NO ORIGINAL (id | forma | transliteração | lema | Strong | sentido):\n" + words.map((w) => `[${w.id}] ${w.surface} | ${w.translit ?? ""} | ${w.lemma ?? ""} | ${w.strong} | ${w.gloss ?? ""}${w.lexicon ? ` — ${w.lexicon.slice(0, 160)}` : ""}`).join("\n") : "",
    excerpts.length ? "TRECHOS DA BIBLIOTECA (cada um com o id, a tradição e a obra):\n" + excerpts.map((e) => `[${e.id}] (tradição: ${e.tradition}; obra: ${e.work}${e.author ? `, ${e.author}` : ""}) ${e.title ? e.title + ": " : ""}${e.text}`).join("\n---\n") : "",
  ].filter(Boolean).join("\n\n");

  const out: Research = { refs, bible, words, excerpts, text, at: Date.now(), topic };
  cache.set(sessionId, out);
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return out;
}

/** Cross-references of the passage (Treasury of Scripture Knowledge): the ones that appear most often, outside the passage itself. */
export async function crossReferencesFor(refs: string[]): Promise<string[]> {
  if (!refs.length) return [];
  const { expandRefs } = await import("../knowledge/refs-parser");
  const verses = expandRefs(refs).filter((r) => r.split(".").length === 3).slice(0, 40);
  if (!verses.length) return [];
  const rows = await refQuery<{ to_ref: string; n: number }>("select to_ref, count(*)::int n from cross_refs where from_ref = any($1) and not (to_ref = any($1)) group by to_ref order by n desc, to_ref limit 14", [verses]).catch(() => []);
  return rows.map((r) => r.to_ref);
}

/** The sources one section needs, within a budget: the Bible text for most, the original words for key words, library excerpts for traditions. */
export function sourcesFor(r: Research, section: string): string {
  const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n) + "\n[...]" : t);
  const words = r.words.length ? "PALAVRAS NO ORIGINAL (id | forma | transliteração | lema | Strong | sentido):\n" + r.words.map((w) => `[${w.id}] ${w.surface} | ${w.translit ?? ""} | ${w.lemma ?? ""} | ${w.strong} | ${w.gloss ?? ""}${w.lexicon ? ` — ${w.lexicon.slice(0, 160)}` : ""}`).join("\n") : "";
  const excerpts = (each: number) => r.excerpts.length ? "TRECHOS DA BIBLIOTECA (cada um com o id, a tradição e a obra):\n" + r.excerpts.map((e) => `[${e.id}] (tradição: ${e.tradition}; obra: ${e.work}${e.author ? `, ${e.author}` : ""}) ${e.title ? e.title + ": " : ""}${e.text.slice(0, each)}`).join("\n---\n") : "";
  const base = section.split(":")[0];
  if (base === "traditions") return [cut(r.bible, 1200), excerpts(800)].filter(Boolean).join("\n\n");
  if (base === "keywords") return [cut(r.bible, 1800), words].filter(Boolean).join("\n\n");
  return [cut(r.bible, 4500), r.excerpts.length ? excerpts(260) : ""].filter(Boolean).join("\n\n");
}

/** History of interpretation: excerpts from the library grouped by era, so each period can be summarized from its own sources. */
export const HISTORY_ERAS: { era: string; traditions: string[] }[] = [
  { era: "Pais da Igreja", traditions: ["patristic"] },
  { era: "Reformadores", traditions: ["reformed", "lutheran"] },
  { era: "Tradições posteriores", traditions: ["baptist", "wesleyan", "pentecostal", "catholic", "dispensational", "jewish", "general"] },
];
const historyCache = new Map<string, { at: number; list: Excerpt[] }>();
export async function gatherHistory(db: SupabaseClient, sessionId: string, ctx: Record<string, unknown>): Promise<Excerpt[]> {
  const hit = historyCache.get(sessionId);
  if (hit && Date.now() - hit.at < 15 * 60_000 && hit.list.length) return hit.list;
  const topic = String(ctx.ref ?? ctx.ref_or_theme ?? ctx.topic ?? "");
  if (!topic) return [];
  const refs = findReferences(topic).flatMap((r) => r.refs).slice(0, 2);
  const list: Excerpt[] = [];
  for (const g of HISTORY_ERAS) {
    const { data: ws } = await db.from("works").select("id, title, authors, tradition, pub_year, source_url, translators").in("tradition", g.traditions).eq("enabled", true).in("kind", ["commentary", "theology", "history", "study_notes"]).limit(400);
    const byId = new Map((ws ?? []).map((w) => [w.id as string, w as { id: string; title: string; authors: string[] | null; tradition: string; pub_year: number | null; source_url: string | null; translators: string[] | null }]));
    if (!byId.size) continue;
    const found = await searchChunks(topic, { workIds: [...byId.keys()], maxTokens: 2200, maxBible: 0, maxChunks: 4, extraRefs: refs }).catch(() => ({ chunks: [], refs: [] as string[] }));
    for (const c of found.chunks.filter((x) => byId.has(x.work_id)).slice(0, 2)) {
      const w = byId.get(c.work_id)!;
      list.push({ id: `h${list.length + 1}`, workId: c.work_id, work: w.title, author: (w.authors ?? []).join(", "), tradition: g.era, title: c.title_path ?? "", text: c.text.slice(0, 800), authors: w.authors ?? [], year: w.pub_year, url: w.source_url, translators: w.translators });
    }
  }
  historyCache.set(sessionId, { at: Date.now(), list });
  return list;
}

/** Sources for the history section: the excerpts grouped by era. */
export function historySources(list: Excerpt[]): string {
  return list.length ? "TRECHOS POR ÉPOCA (cada um com o id, a época e a obra):\n" + list.map((e) => `[${e.id}] (época: ${e.tradition}; obra: ${e.work}${e.author ? `, ${e.author}` : ""}${e.year ? `, ${e.year}` : ""}) ${e.text}`).join("\n---\n") : "";
}
