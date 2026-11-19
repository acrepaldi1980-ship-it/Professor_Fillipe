// Originality report for own notes (spec 8.11): compares each paragraph with the text of the works in the base, by word
// 5-gram containment and by embedding cosine, and flags what is at or above the threshold (0.85) for automatic rewriting.
export const SIMILARITY_THRESHOLD = 0.85;

// Raw measures are mapped to a 0..1 similarity before the 0.85 threshold of the spec. Measured on the base: the multilingual
// e5 embedding gives 0.78 to 0.85 to any two passages on the same biblical subject with no shared wording, so a raw 0.85
// would flag every note. The mapping keeps 0.85 as the threshold: it flags at ~30% shared 5-grams or embedding cosine ~0.94.
export const NGRAM_FULL = 0.35; // containment that counts as similarity 1
export const COSINE_FLOOR = 0.78; // embedding cosine of related-but-different text
export const COSINE_CEIL = 0.97; // embedding cosine of near-identical text
export const normNgram = (c: number) => Math.min(1, c / NGRAM_FULL);
export const normCosine = (c: number) => Math.min(1, Math.max(0, (c - COSINE_FLOOR) / (COSINE_CEIL - COSINE_FLOOR)));

export interface ParagraphScore {
  index: number;
  ngram: number;
  cosine: number;
  similarity: number;
  source: string | null;
  flagged: boolean;
}
export interface OriginalityReport {
  threshold: number;
  maxSimilarity: number;
  paragraphs: ParagraphScore[];
  rewrites: number;
  checkedAt: string;
}

export interface Source {
  id: string;
  text: string;
}

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

export function paragraphsOf(body: string): string[] {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function shingles(text: string, n = 5): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** Share of the paragraph's 5-grams that also occur in the source (0 to 1). */
export function containment(paragraph: string, source: string): number {
  const a = shingles(paragraph);
  if (a.size === 0) return 0;
  const b = shingles(source);
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / a.size;
}

/** Overlapping windows of ~`size` words, so a paragraph is compared with passages of the same length, not with a whole chunk. */
export function windows(text: string, size = 90): string[] {
  const w = text.split(/\s+/).filter(Boolean);
  if (w.length <= size) return [w.join(" ")];
  const out: string[] = [];
  for (let i = 0; i < w.length; i += Math.floor(size / 2)) {
    out.push(w.slice(i, i + size).join(" "));
    if (i + size >= w.length) break;
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? d / Math.sqrt(x * y) : 0;
}

export interface Deps {
  /** Candidate source passages for a paragraph (the base search, without Bible text and without own notes). */
  sourcesFor(paragraph: string): Promise<Source[]>;
  embed(texts: string[]): Promise<number[][]>;
}

export async function scoreParagraph(paragraph: string, index: number, deps: Deps): Promise<ParagraphScore> {
  const sources = (await deps.sourcesFor(paragraph)).slice(0, 4);
  let ngram = 0, best = 0;
  let source: string | null = null;
  const wins: { id: string; text: string }[] = [];
  for (const s of sources) {
    const c = containment(paragraph, s.text);
    if (c > ngram) { ngram = c; source = s.id; }
    for (const w of windows(s.text)) wins.push({ id: s.id, text: w });
  }
  let cos = 0;
  if (wins.length) {
    const vecs = await deps.embed([paragraph, ...wins.map((w) => w.text)]);
    for (let i = 0; i < wins.length; i++) {
      const c = cosine(vecs[0], vecs[i + 1]);
      if (c > cos) { cos = c; best = i; }
    }
    if (cos > ngram && wins[best]) source = wins[best].id;
  }
  const similarity = Math.max(normNgram(ngram), normCosine(cos));
  return { index, ngram: +ngram.toFixed(3), cosine: +cos.toFixed(3), similarity: +similarity.toFixed(3), source, flagged: similarity >= SIMILARITY_THRESHOLD };
}

export interface CheckResult {
  body: string;
  report: OriginalityReport;
}

/** Scores every paragraph; flagged ones are rewritten with `rewrite` and rescored, up to `maxRounds` times. */
export async function checkAndRewrite(
  body: string,
  deps: Deps & { rewrite(paragraph: string, sourceId: string | null): Promise<string> },
  maxRounds = 2,
): Promise<CheckResult> {
  const paras = paragraphsOf(body);
  let rewrites = 0;
  let scores: ParagraphScore[] = [];
  for (let round = 0; round <= maxRounds; round++) {
    scores = await Promise.all(paras.map((p, i) => (words(p).length < 12 ? Promise.resolve({ index: i, ngram: 0, cosine: 0, similarity: 0, source: null, flagged: false }) : scoreParagraph(p, i, deps))));
    const flagged = scores.filter((s) => s.flagged);
    if (!flagged.length || round === maxRounds) break;
    for (const s of flagged) {
      paras[s.index] = await deps.rewrite(paras[s.index], s.source);
      rewrites++;
    }
  }
  return {
    body: paras.join("\n\n"),
    report: { threshold: SIMILARITY_THRESHOLD, maxSimilarity: Math.max(0, ...scores.map((s) => s.similarity)), paragraphs: scores, rewrites, checkedAt: new Date().toISOString() },
  };
}
