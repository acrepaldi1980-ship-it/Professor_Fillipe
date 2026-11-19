// Original-language text word by word (Greek NT, STEPBible TAGNT) with the brief lexicon entry of each word.
// Server only; uses the publishable Supabase key (the tables are public-read reference data).
import { createClient } from "@supabase/supabase-js";
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

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_not_configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getOriginalWords(canonicalRef: string, withLexicon = true): Promise<OriginalWord[]> {
  const refs = expandRefs([canonicalRef]).filter((r) => r.split(".").length === 3).slice(0, 40);
  if (!refs.length) return [];
  const db = client();
  const { data, error } = await db
    .from("original_words")
    .select("ref,position,surface,lemma,strong,morph,translit,gloss")
    .in("ref", refs)
    .eq("source", "step_tagnt")
    .order("ref")
    .order("position")
    .limit(1200);
  if (error) throw new Error(`original_failed: ${error.message.slice(0, 120)}`);
  const words = (data ?? []) as OriginalWord[];
  if (!withLexicon || !words.length) return words;
  const strongs = [...new Set(words.map((w) => w.strong).filter((s): s is string => !!s))];
  const { data: lex } = await db.from("lexicon_entries").select("strong,definition").in("strong", strongs).eq("source", "step_tbesg");
  const byStrong = new Map<string, string>();
  for (const l of lex ?? []) if (l.strong && !byStrong.has(l.strong)) byStrong.set(l.strong, l.definition.slice(0, 400));
  return words.map((w) => ({ ...w, lexicon: w.strong ? byStrong.get(w.strong) : undefined }));
}
