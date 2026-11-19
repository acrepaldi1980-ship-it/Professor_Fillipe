// Hybrid search (spec 8.10.4): exact references + semantic + keyword, fused with RRF in SQL (search_chunks),
// then re-ranked by authority layer (8.10.6) and trimmed to a prompt budget.
import { getLibraryStore, type LibraryStore } from "./library-store";
import { getStore, type KnowledgeStore } from "./db";
import { getEmbeddingProvider, type EmbeddingProvider } from "./embeddings";
import { expandRefs, findReferences } from "./refs-parser";
import { topicRefs } from "./topics";

export interface Retrieved {
  id: string;
  work_id: string;
  text: string;
  title_path: string | null;
  refs: string[];
  tradition: string;
  kind: string;
  language: string;
  tokens: number | null;
  rrf: number;
  signals: string[];
  layer: number;
  weight: number;
  score: number;
}

export interface BibleVerse {
  version_id: string;
  ref: string;
  text: string;
}

export interface SearchOptions {
  /** Lenses chosen by the student (traditions). Phase 0 ignores them for weighting; kept for the full engine. */
  lenses?: string[];
  workIds?: string[];
  maxChunks?: number;
  maxTokens?: number;
  /** Cap on Bible chunks so dictionaries/commentaries can show up too (default 5). */
  maxBible?: number;
  perSignal?: number;
  /** Words of the question (and its English keywords): a dictionary entry titled with one of them gets a boost. */
  terms?: string[];
  /** References carried over from the previous turn (follow-up questions). */
  extraRefs?: string[];
}

/** Authority layers (spec 8.10.6). */
export function authorityLayer(kind: string, tradition: string, lenses: string[] = []): { layer: number; weight: number } {
  if (kind === "bible_text") return { layer: 1, weight: 1.0 };
  if (kind === "lexicon") return { layer: 2, weight: 0.95 };
  if (lenses.includes(tradition) && ["own_notes", "commentary", "theology", "study_notes"].includes(kind)) return { layer: 3, weight: 0.9 };
  if (["history", "archaeology", "academic_article", "geodata"].includes(kind)) return { layer: 4, weight: 0.8 };
  if (kind === "encyclopedia") return { layer: 6, weight: 0.6 };
  return { layer: 5, weight: 0.7 }; // dictionaries and works from other traditions
}

const ENTRY_KINDS = new Set(["dictionary", "encyclopedia", "lexicon"]);

/** Words of a question that can name a dictionary entry ("Barnabas", "Ark of the Covenant" -> "ark", "covenant"...). */
export function queryTerms(queries: string[]): string[] {
  const out = new Set<string>();
  // The first phrasing is the question; the others are English keywords where the subject comes first, so only their first items count.
  const scoped = queries.map((q, i) => (i === 0 ? q : q.split(",").slice(0, 2).join(" ")));
  for (const q of scoped) for (const w of q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z]+/)) if (w.length >= 4) out.add(w);
  return [...out];
}

/** "Who was X?" / "What is X?": an entry titled exactly with a word of the question beats a loosely related Bible window. */
export function entryBoost(r: { kind: string; title_path: string | null }, terms?: string[]): number {
  if (!terms?.length || !ENTRY_KINDS.has(r.kind) || !r.title_path) return 1;
  const key = r.title_path.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[,(]/)[0].replace(/[^a-z ]/g, "").trim();
  return key.length >= 3 && terms.includes(key) ? 1.9 : 1;
}

/** Re-rank by authority and keep the best chunks within the budget; guarantee one Bible chunk when available. */
export function rerankAndSelect(
  rows: Omit<Retrieved, "layer" | "weight" | "score">[],
  opts: SearchOptions = {},
): Retrieved[] {
  const maxChunks = opts.maxChunks ?? 12;
  const maxTokens = opts.maxTokens ?? 6000;
  const scored: Retrieved[] = rows
    .map((r) => {
      const a = authorityLayer(r.kind, r.tradition, opts.lenses);
      return { ...r, ...a, score: r.rrf * a.weight * entryBoost(r, opts.terms) };
    })
    .sort((x, y) => y.score - x.score);

  const maxBible = opts.maxBible ?? 5;
  const picked: Retrieved[] = [];
  let tokens = 0;
  let bibleCount = 0;
  const add = (r: Retrieved) => {
    picked.push(r);
    tokens += r.tokens ?? 500;
    if (r.kind === "bible_text") bibleCount++;
  };
  const fits = (r: Retrieved) => picked.length < maxChunks && !picked.includes(r) && tokens + (r.tokens ?? 500) <= maxTokens;
  // 1) always keep the best Bible chunk; 2) fill with the best of everything, Bible capped; 3) top up with Bible if room remains.
  const bible = scored.find((r) => r.kind === "bible_text");
  if (bible) add(bible);
  for (const r of scored) if (fits(r) && (r.kind !== "bible_text" || bibleCount < maxBible)) add(r);
  for (const r of scored) if (fits(r)) add(r);
  return picked.sort((x, y) => y.score - x.score);
}

type Row = Omit<Retrieved, "layer" | "weight" | "score">;

/** Runs the hybrid search for one or more phrasings of the question (e.g. Portuguese + English keywords) and fuses them. */
export async function searchChunks(
  query: string | string[],
  opts: SearchOptions = {},
  deps: { store?: KnowledgeStore; embeddings?: EmbeddingProvider; library?: LibraryStore | null } = {},
): Promise<{ chunks: Retrieved[]; refs: string[] }> {
  const store = deps.store ?? getStore();
  // Library works live in a second database; its failure must never break a search.
  const library = deps.library === undefined ? (deps.store ? undefined : getLibraryStore()) : (deps.library ?? undefined);
  const emb = deps.embeddings ?? getEmbeddingProvider();
  const queries = (Array.isArray(query) ? query : [query]).filter(Boolean);
  const per = opts.perSignal ?? 40;
  // References named by the student, passages suggested with the English keywords, and well-known passages (topics.ts).
  const refs = expandRefs([...queries.flatMap((q) => findReferences(q).flatMap((r) => r.refs)), ...topicRefs(queries[0] ?? ""), ...(opts.extraRefs ?? [])]);

  const results = await Promise.all(
    queries.map(async (q, i) => {
      const vec = await emb.embedQuery(q);
      const args = { embedding: vec, text: q, refs: i === 0 ? refs : [], perSignal: per, workIds: opts.workIds ?? null };
      const [main, lib] = await Promise.all([store.searchChunks(args), library ? library.searchChunks(args).catch(() => []) : Promise.resolve([])]);
      return [...main, ...lib];
    }),
  );
  const merged = new Map<string, Row>();
  for (const rows of results) {
    for (const r of rows) {
      const prev = merged.get(r.id);
      merged.set(r.id, prev ? { ...prev, rrf: prev.rrf + r.rrf, signals: [...new Set([...prev.signals, ...r.signals])] } : r);
    }
  }
  // Entries titled with a word of the question (the other signals can miss them when many Bible windows match).
  const terms = queryTerms(queries);
  if (store.titleChunks && terms.length) {
    const byTitle = await store.titleChunks(terms).catch(() => []);
    for (const r of byTitle) if (!merged.has(r.id)) merged.set(r.id, r);
  }
  return { chunks: rerankAndSelect([...merged.values()], { terms, ...opts }), refs };
}

/** Exact Bible verses for canonical refs (expanded to verse level) in one version. */
export async function getVerses(versionId: string, canonicalRefs: string[], deps: { store?: KnowledgeStore } = {}): Promise<BibleVerse[]> {
  const store = deps.store ?? getStore();
  const verseRefs = expandRefs(canonicalRefs).filter((r) => r.split(".").length === 3);
  const chapters = canonicalRefs.filter((r) => !r.includes("-") && r.split(".").length === 2);
  if (!verseRefs.length && !chapters.length) return [];
  return store.bibleVerses(versionId, verseRefs, chapters);
}
