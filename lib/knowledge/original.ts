// Original-language text word by word (Greek NT, STEPBible TAGNT) with the brief lexicon entry of each word.
// Server only; reads the reference database (Neon).
import { refQuery } from "./reference-db";
import { expandRefs } from "./refs-parser";

export interface OriginalWord {
  ref: string;
  position: number;
  surface: string;
  lemma: string | null;
  strong: string | null;
  morph: string | null;
  translit: string | null;
  gloss: string | null;
  lexicon?: string;
}

export async function getOriginalWords(canonicalRef: string, withLexicon = true): Promise<OriginalWord[]> {
  const refs = expandRefs([canonicalRef]).filter((r) => r.split(".").length === 3).slice(0, 40);
  if (!refs.length) return [];
  const words = await refQuery<OriginalWord>(
    "select ref, position, surface, lemma, strong, morph, translit, gloss from original_words where ref = any($1) and source = 'step_tagnt' order by ref, position limit 1200",
    [refs],
  );
  if (!withLexicon || !words.length) return words;
  const strongs = [...new Set(words.map((w) => w.strong).filter((x): x is string => !!x))];
  const lex = await refQuery<{ strong: string; definition: string }>("select strong, definition from lexicon_entries where strong = any($1) and source = 'step_tbesg' order by id", [strongs]);
  const byStrong = new Map<string, string>();
  for (const l of lex) if (l.strong && !byStrong.has(l.strong)) byStrong.set(l.strong, l.definition.slice(0, 400));
  return words.map((w) => ({ ...w, lexicon: w.strong ? byStrong.get(w.strong) : undefined }));
}
