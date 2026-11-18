// Hybrid search (spec 8.10.4): exact references + semantic + keyword, fused with RRF in SQL (search_chunks),
// then re-ranked by authority layer (8.10.6) and trimmed to a prompt budget.
import { getDb, lit, litArray, litVector, type Db } from "./db";
import { getEmbeddingProvider, type EmbeddingProvider } from "./embeddings";
import { expandRefs, findReferences } from "./refs-parser";

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
      return { ...r, ...a, score: r.rrf * a.weight };
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

export async function searchChunks(
  query: string,
  opts: SearchOptions = {},
  deps: { db?: Db; embeddings?: EmbeddingProvider } = {},
): Promise<{ chunks: Retrieved[]; refs: string[] }> {
  const db = deps.db ?? getDb();
  const emb = deps.embeddings ?? getEmbeddingProvider();
  const refs = expandRefs(findReferences(query).flatMap((r) => r.refs));
  const vec = await emb.embedQuery(query);
  const per = opts.perSignal ?? 40;
  const rows = await db.query<Omit<Retrieved, "layer" | "weight" | "score">>(
    `select * from search_chunks(${litVector(vec)}, ${lit(query)}, ${litArray(refs)}, ${per}, ${opts.workIds ? litArray(opts.workIds) : "null"})`,
  );
  return { chunks: rerankAndSelect(rows, opts), refs };
}

/** Exact Bible verses for canonical refs (expanded to verse level) in one version. */
export async function getVerses(versionId: string, canonicalRefs: string[], deps: { db?: Db } = {}): Promise<BibleVerse[]> {
  const db = deps.db ?? getDb();
  const verseRefs = expandRefs(canonicalRefs).filter((r) => r.split(".").length === 3);
  const chapters = canonicalRefs.filter((r) => !r.includes("-") && r.split(".").length === 2);
  const where: string[] = [];
  if (verseRefs.length) where.push(`ref = any (${litArray(verseRefs)})`);
  for (const c of chapters) {
    const [book, ch] = c.split(".");
    where.push(`(book_code = ${lit(book)} and chapter = ${Number(ch)})`);
  }
  if (!where.length) return [];
  return db.query<BibleVerse>(
    `select version_id, ref, text from bible_verses where version_id = ${lit(versionId)} and (${where.join(" or ")}) order by book_code, chapter, verse limit 300`,
  );
}
