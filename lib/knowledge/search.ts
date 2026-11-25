// Hybrid search (spec 8.10.4): exact references + semantic + keyword, fused with RRF in SQL (search_chunks),
// then re-ranked by authority layer (8.10.6) and trimmed to a prompt budget.
import { englishQuery } from "./glossary";
import { entityHints } from "./entities";
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
  /** Filled with the milliseconds of each stage (diagnostics: where does a slow question spend its time?). */
  trace?: Record<string, number>;
  /** Second attempt after an empty result (cold databases): the budgets are 2.5 times longer. Set by searchChunks itself. */
  patient?: boolean;
  /** English keywords for the question, still being produced by a model: the search starts without them and adds them if they arrive in time. */
  extraQuery?: Promise<string | null>;
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
/** Words that name too many entries to say what is asked ("Bible" for "o que a Bíblia diz sobre Nicodemos", "Mount" for "Mount Carmel"). */
const GENERIC_TITLE_TERMS = new Set(["bible", "scripture", "scriptures", "mount", "mountain", "river", "city", "land", "lord", "king", "valley", "lake", "house", "temple", "tribe", "church", "people", "book", "word", "what", "about", "tell", "everything", "sobre", "fale", "tudo", "diga", "conte", "explique", "quem", "qual", "quais", "como", "onde", "quando", "porque", "biblia", "biblico", "biblica"]);

export function queryTerms(queries: string[]): string[] {
  const out = new Set<string>();
  // The first phrasing is the question; the others are English keywords where the subject comes first, so only their first items count.
  const scoped = queries.map((q, i) => (i === 0 ? q : q.split(",").slice(0, 2).join(" ")));
  for (const q of scoped) for (const w of q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z]+/)) if (w.length >= 4 && !GENERIC_TITLE_TERMS.has(w)) out.add(w);
  return [...out];
}

/** "Who was X?" / "What is X?": an entry titled exactly with a word of the question beats a loosely related Bible window. */
export function entryBoost(r: { kind: string; title_path: string | null }, terms?: string[]): number {
  if (!terms?.length || !ENTRY_KINDS.has(r.kind) || !r.title_path) return 1;
  const key = r.title_path.split(">").pop()!.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[,(]/)[0].replace(/[^a-z ]/g, "").trim();
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
      // Chunks found by the student's lens search (works of their tradition) are what the student asked to hear: boost them.
      return { ...r, ...a, score: r.rrf * a.weight * entryBoost(r, opts.terms) * (r.signals.includes("lens") ? LENS_BOOST : r.signals.includes("contrast") ? CONTRAST_BOOST : 1) };
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
// Speed: the library database (Neon) scales to zero and can take many seconds on the first query after idle time, so the
// search waits for it only for a short budget (it keeps warming in the background for the next question). Bible windows and
// dictionary entries (Supabase) always answer. Repeated questions are served from a small cache.
const LIBRARY_BUDGET_MS = Number(process.env.LIBRARY_BUDGET_MS) || 2500;
/** The main database must answer within this budget or the question goes on with what is ready (verses, titles, library): a spoken conversation cannot wait 10 s. */
const MAIN_BUDGET_MS = Number(process.env.MAIN_BUDGET_MS) || 3200;
const TITLES_BUDGET_MS = Number(process.env.TITLES_BUDGET_MS) || 1500;
const EXTRA_BUDGET_MS = Number(process.env.EXTRA_QUERY_BUDGET_MS) || 1600;
const CACHE_TTL_MS = 5 * 60 * 1000;
const LENS_BOOST = 1.7;
const CONTRAST_BOOST = 1.4;
const ALL_LENSES = ["pentecostal", "baptist", "reformed", "wesleyan", "lutheran", "anabaptist", "dispensational", "catholic", "orthodox"];
const lensCache = new Map<string, { at: number; ids: string[] }>();
async function lensWorkIds(store: KnowledgeStore, lenses: string[]): Promise<string[]> {
  if (!store.lensWorks || !lenses.length) return [];
  const key = [...lenses].sort().join(",");
  const hit = lensCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.ids;
  const ids = await store.lensWorks(lenses).catch(() => [] as string[]);
  lensCache.set(key, { at: Date.now(), ids });
  return ids;
}

const embedMemo = new Map<string, Promise<number[]>>();
/** The same text is embedded by the main search, the lens search and the contrast search: do it once. */
function memoEmbed(emb: EmbeddingProvider): EmbeddingProvider {
  return { name: emb.name, dimensions: emb.dimensions, embedPassages: (t) => emb.embedPassages(t), embedQuery: (text) => { const k = `${emb.name}|${text}`; let p = embedMemo.get(k); if (!p) { p = emb.embedQuery(text); embedMemo.set(k, p); if (embedMemo.size > 200) embedMemo.delete(embedMemo.keys().next().value as string); p.catch(() => embedMemo.delete(k)); } return p; } };
}

const searchCache = new Map<string, { at: number; value: { chunks: Retrieved[]; refs: string[] } }>();

const within = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);

export async function searchChunks(
  query: string | string[],
  opts: SearchOptions = {},
  deps: { store?: KnowledgeStore; embeddings?: EmbeddingProvider; library?: LibraryStore | null } = {},
): Promise<{ chunks: Retrieved[]; refs: string[] }> {
  const store = deps.store ?? getStore();
  // Library works live in a second database; its failure must never break a search.
  const library = deps.library === undefined ? (deps.store ? undefined : getLibraryStore()) : (deps.library ?? undefined);
  const emb = memoEmbed(deps.embeddings ?? getEmbeddingProvider());
  const queries = (Array.isArray(query) ? query : [query]).filter(Boolean);
  // a safe English phrasing from the glossary, so the library (mostly English) is found even when the model that rewrites questions is down
  const auto = queries[0] ? englishQuery(queries[0]) : null;
  if (auto && !queries.includes(auto)) queries.push(auto);
  // The people, places and events of the Bible named in the question ("Zaqueu" -> Zacchaeus, Luke 19): their English names reach the English works and the dictionary entries,
  // their verses are asked for exactly, and the search looks for the SUBJECT ("Zaqueu Zacchaeus"), not for the whole sentence ("Me fale tudo sobre Zaqueu").
  // (a question that cites a verse is precise already: names inside it are not looked up)
  const typedRefs = queries[0] ? findReferences(queries[0]).length > 0 : false;
  const hints = queries[0] && !typedRefs && process.env.SEARCH_ENTITIES !== "off" ? entityHints(queries[0]) : { names: [], refs: [], subject: "", matches: [], aboutEntity: false };
  const subjectQuery = [hints.subject, ...hints.names].filter(Boolean).join(" ").trim();
  // a question only ABOUT the entity is searched as its subject ("Zaqueu Zacchaeus"): the filler of the sentence ("me fale tudo sobre") only adds noise, and no extra search is needed
  const original = queries[0];
  if (subjectQuery && hints.names.length && hints.aboutEntity) queries[0] = subjectQuery;
  else if (subjectQuery && hints.names.length && !queries.includes(subjectQuery)) queries.splice(1, 0, subjectQuery);
  if (opts.trace && hints.matches.length) opts.trace.entities = hints.matches.length;
  const per = opts.perSignal ?? 24;
  const cacheKey = deps.store || deps.embeddings ? null : JSON.stringify([queries, opts.lenses, opts.extraRefs, opts.maxTokens, opts.maxChunks, opts.workIds]);
  const hit = cacheKey ? searchCache.get(cacheKey) : undefined;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) { if (opts.trace) opts.trace.cache = 1; return hit.value; }
  const T0 = Date.now();
  const k = opts.patient ? 2.5 : 1;
  const mark = (name: string) => { if (opts.trace) opts.trace[name] = Math.max(opts.trace[name] ?? 0, Date.now() - T0); };

  // References named by the student, passages suggested with the English keywords, and well-known passages (topics.ts).
  const refs = expandRefs([...[original, ...queries].flatMap((q) => (q ? findReferences(q).flatMap((r) => r.refs) : [])), ...topicRefs(original ?? ""), ...hints.refs, ...(opts.extraRefs ?? [])]);
  let terms = queryTerms(queries);
  // Entries titled with a word of the question start at once, in parallel with the semantic and keyword searches.
  // Each source of entries answers (or not) on its own: a slow one must not take the fast one's entries down with it.
  const titleSources = terms.length
    ? [
        store.titleChunks ? within(store.titleChunks(terms), TITLES_BUDGET_MS * k, [] as Row[]) : null,
        library?.titleChunks ? within(library.titleChunks(terms, original), LIBRARY_BUDGET_MS * k, [] as Row[]) : null,
      ].filter((p): p is Promise<Row[]> => !!p)
    : [];
  const titlePromise = Promise.all(titleSources.map((p) => p.catch(() => [] as Row[]))).then((parts) => { mark("titles"); return parts.flat(); });

  // The student's lens: one more search restricted to the works of that tradition, so a divergent topic gets that side's sources.
  const lensIds = opts.lenses?.length && !opts.workIds ? await lensWorkIds(store, opts.lenses) : [];
  mark("lensIds");
  const lensSearch = async (ids: string[], signal: "lens" | "contrast", per: number): Promise<Row[]> => {
    if (!ids.length) return [];
    // The lens works are mostly English: search with the English keywords when the question was rewritten.
    const lensText = queries[queries.length - 1];
    const vec = await emb.embedQuery(lensText);
    const args = { embedding: vec, text: lensText, refs: [] as string[], perSignal: per, workIds: ids };
    // Library works (pg_...) live in the second database; the main one only holds the app's own notes. A filtered vector search over a long
    // id list is slow there, so it is skipped unless there is a non-library id to look for.
    const mainIds = ids.filter((id) => !id.startsWith("pg_"));
    const [main, lib] = await Promise.all([
      mainIds.length ? within(store.searchChunks({ ...args, workIds: mainIds }), 2500 * k, [] as Row[]) : Promise.resolve([] as Row[]),
      library ? within(library.searchChunks(args), LIBRARY_BUDGET_MS * k, [] as Row[]) : Promise.resolve([] as Row[]),
    ]);
    return [...main, ...lib].map((r) => ({ ...r, signals: [...r.signals, signal] }));
  };
  // Divergent topics need both sides: the lens works, plus the works of the other traditions (so "another reading, with source" exists).
  const contrastIds = lensIds.length ? await lensWorkIds(store, ALL_LENSES.filter((l) => !opts.lenses!.includes(l))) : [];
  mark("contrastIds");
  const lensPromise = Promise.all([lensSearch(lensIds, "lens", 12), lensSearch(contrastIds, "contrast", 8)]).then(([a, b]) => { mark("lensSearch"); return [...a, ...b]; });

  // did the main database (Bible windows, dictionaries, the app's notes) answer in time? When it did not, the answer would have no Bible text at all: try once more, patiently
  let mainAnswered = false;
  const runQuery = async (q: string, i: number): Promise<Row[]> => {
    const vec = await emb.embedQuery(q);
    mark(`embed${i}`);
    const args = { embedding: vec, text: q, refs: i === 0 ? refs : [], perSignal: per, workIds: opts.workIds ?? null };
    const [main, lib] = await Promise.all([within(store.searchChunks(args).then((r) => { mark(`main${i}`); if (i === 0) mainAnswered = true; return r; }), MAIN_BUDGET_MS * k, [] as Row[]), library ? within(library.searchChunks(args).then((r) => { mark(`lib${i}`); return r; }), LIBRARY_BUDGET_MS, [] as Row[]) : Promise.resolve([] as Row[])]);
    return [...main, ...lib];
  };
  // The English keywords come from a model call that can take seconds: the search does not wait for it, it uses them only if they arrive in time.
  let extraQ: string | null = null;
  const extraResults: Promise<Row[]> = opts.extraQuery
    ? within(opts.extraQuery.then(async (q) => { if (!q) return [] as Row[]; extraQ = q; mark("extraReady"); return runQuery(q, queries.length); }), EXTRA_BUDGET_MS, [] as Row[])
    : Promise.resolve([] as Row[]);
  const results = await Promise.all([...queries.map((q, i) => runQuery(q, i)), extraResults]);
  const merged = new Map<string, Row>();
  for (const rows of results) {
    for (const r of rows) {
      const prev = merged.get(r.id);
      merged.set(r.id, prev ? { ...prev, rrf: prev.rrf + r.rrf, signals: [...new Set([...prev.signals, ...r.signals])] } : r);
    }
  }
  if (extraQ) terms = queryTerms([...queries, extraQ]);
  // an entry found by its title that the other signals also found: the title match adds to its score (it is not dropped as a duplicate)
  for (const r of await titlePromise) {
    const prev = merged.get(r.id);
    merged.set(r.id, prev ? { ...prev, rrf: prev.rrf + r.rrf, signals: [...new Set([...prev.signals, ...r.signals])] } : r);
  }
  for (const r of await lensPromise) {
    const prev = merged.get(r.id);
    merged.set(r.id, prev ? { ...prev, rrf: prev.rrf + r.rrf, signals: [...new Set([...prev.signals, ...r.signals])] } : r);
  }
  mark("fetched");
  const value = { chunks: rerankAndSelect([...merged.values()], { terms, ...opts }), refs };
  // Nothing came back: a cold database or embedding model timed out (the first question after idle time). Try once more, patiently, now that they are warm;
  // an empty answer must never reach the teacher as "no sources" when the sources exist.
  if ((!value.chunks.length || !mainAnswered) && !opts.patient && !deps.store) return searchChunks(query, { ...opts, patient: true }, deps);
  if (cacheKey && value.chunks.length) {
    searchCache.set(cacheKey, { at: Date.now(), value });
    if (searchCache.size > 60) searchCache.delete(searchCache.keys().next().value as string);
  }
  return value;
}

/** Exact Bible verses for canonical refs (expanded to verse level) in one version. */
export async function getVerses(versionId: string, canonicalRefs: string[], deps: { store?: KnowledgeStore } = {}): Promise<BibleVerse[]> {
  const store = deps.store ?? getStore();
  const verseRefs = expandRefs(canonicalRefs).filter((r) => r.split(".").length === 3);
  const chapters = canonicalRefs.filter((r) => !r.includes("-") && r.split(".").length === 2);
  if (!verseRefs.length && !chapters.length) return [];
  return store.bibleVerses(versionId, verseRefs, chapters);
}
