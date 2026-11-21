// Interlinear and word study (spec 8.7.4 P1) on the STEPBible data (Neon): each word with its morphology in Portuguese, and for one Strong number
// the lexicon entries, every occurrence in the original text and the range of senses the interlinear glosses give it. Server only.
import { decodeMorph, langOfStrong, type Morph } from "./morphology";
import { refQuery } from "./reference-db";
import { expandRefs } from "./refs-parser";

export interface InterlinearWord { ref: string; position: number; surface: string; lemma: string | null; strong: string | null; translit: string | null; gloss: string | null; morph: string | null; morphPt: Morph | null; lang: "grc" | "heb" }

export const strongBase = (s: string) => /^[GH]\d{1,4}/.exec(s)?.[0] ?? "";

/** Words of a verse or range (up to 40 verses) with decoded morphology. */
export async function getInterlinear(canonicalRef: string): Promise<InterlinearWord[]> {
  const refs = expandRefs([canonicalRef]).filter((r) => r.split(".").length === 3).slice(0, 40);
  if (!refs.length) return [];
  const rows = await refQuery<{ ref: string; position: number; surface: string; lemma: string | null; strong: string | null; translit: string | null; gloss: string | null; morph: string | null }>(
    "select ref, position, surface, lemma, strong, translit, gloss, morph from original_words where ref = any($1) order by ref, position limit 1500", [refs]);
  return rows.map((w) => ({ ...w, lang: langOfStrong(w.strong), morphPt: decodeMorph(w.morph, langOfStrong(w.strong)) }));
}

export interface WordStudy {
  strong: string;
  lemma: string | null;
  lang: "grc" | "heb";
  occurrences: number;
  /** How the interlinear glosses this word across the text (count per gloss): its range of senses as the data shows it. */
  senses: { gloss: string; n: number }[];
  entries: { source: string; definition: string }[];
  sample: { ref: string; surface: string; gloss: string | null }[];
}

const clean = (g: string) => g.replace(/[\[\]<>]/g, "").replace(/\s+/g, " ").replace(/[,;.]+$/, "").trim().toLowerCase();
const SOURCE: Record<string, string> = { step_tbesg: "Léxico breve de grego (TBESG, CC BY 4.0)", step_tflsj: "Léxico grego-inglês (LSJ, domínio público)", step_tbesh: "Léxico breve de hebraico (TBESH, CC BY 4.0)", step_tahot: "STEPBible" };

export async function getWordStudy(strongRaw: string): Promise<WordStudy | null> {
  const base = strongBase(strongRaw);
  if (!base) return null;
  const like = `${base}%`;
  const [cnt, glosses, entries, sample] = await Promise.all([
    refQuery<{ n: number; lemma: string | null }>("select count(*)::int n, max(lemma) lemma from original_words where strong like $1 and strong ~ ($2 || '[A-Za-z]?$')", [like, base]),
    refQuery<{ gloss: string; n: number }>("select gloss, count(*)::int n from original_words where strong like $1 and strong ~ ($2 || '[A-Za-z]?$') and gloss is not null group by gloss order by 2 desc limit 80", [like, base]),
    refQuery<{ source: string; definition: string }>("select source, left(definition, 1200) definition from lexicon_entries where strong = $1 or strong like $2 order by source limit 4", [base, like]),
    refQuery<{ ref: string; surface: string; gloss: string | null }>("select ref, surface, gloss from original_words where strong like $1 and strong ~ ($2 || '[A-Za-z]?$') order by ref limit 400", [like, base]),
  ]);
  const occurrences = cnt[0]?.n ?? 0;
  if (!occurrences) return null;
  // the same sense is written in many ways ("word", "words", "[the] word"): merge by the cleaned gloss
  const merged = new Map<string, number>();
  for (const g of glosses) { const k = clean(g.gloss); if (k) merged.set(k, (merged.get(k) ?? 0) + g.n); }
  const senses = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([gloss, n]) => ({ gloss, n }));
  // a sample spread across the text (first, then every k-th) so it is not only Genesis or Matthew
  const step = Math.max(1, Math.floor(sample.length / 30));
  return {
    strong: strongRaw, lemma: cnt[0]?.lemma ?? null, lang: langOfStrong(base), occurrences, senses,
    entries: entries.map((e) => ({ source: SOURCE[e.source] ?? e.source, definition: e.definition })),
    sample: sample.filter((_, i) => i % step === 0).slice(0, 30),
  };
}
