// Prepares the teacher's text for speech: expands Bible references the way a person would read them,
// applies the pronunciation lexicon and splits into sentences for sentence-by-sentence streaming (RF-M06-03).
import lexicon from "./lexicon.pt-BR.json";
import { findReferences } from "../knowledge/refs-parser";
import { BOOK_BY_CODE } from "../knowledge/books";

function speakRef(ref: string): string {
  const [a, b] = ref.split("-");
  const part = (r: string) => {
    const [code, c, v] = r.split(".");
    return { name: BOOK_BY_CODE[code]?.pt ?? code, c, v };
  };
  const x = part(a);
  const book = x.name.replace(/^1 /, "Primeiro ").replace(/^2 /, "Segundo ").replace(/^3 /, "Terceiro ");
  if (!b) return x.v ? `${book}, capítulo ${x.c}, versículo ${x.v}` : `${book}, capítulo ${x.c}`;
  const y = part(b);
  if (!x.v) return `${book}, capítulos ${x.c} a ${y.c}`;
  return y.c === x.c ? `${book}, capítulo ${x.c}, versículos ${x.v} a ${y.v}` : `${book}, capítulo ${x.c}, versículo ${x.v}, até o capítulo ${y.c}, versículo ${y.v}`;
}

export function expandReferencesForSpeech(text: string): string {
  const found = findReferences(text, { strictCase: true }).filter((r) => !r.invalid && r.refs.length).sort((p, q) => q.index - p.index);
  let out = text;
  for (const f of found) {
    const spoken = f.refs.map(speakRef).join(" e ");
    out = out.slice(0, f.index) + spoken + out.slice(f.index + f.length);
  }
  return out;
}

/**
 * "v. 16", "v16", "vv. 3-5", "vs 7" (a v and a number) are read as "versículo 16" / "versículos 3 a 5": the voice must not spell the letter.
 * Only a lone v/vv/vs followed by a number counts (so "V8" inside a word or "TV 4" are left alone).
 */
export function expandVerseMarkers(text: string): string {
  return text
    // ranges and lists first: vv. 3-5, vv 3 a 5, vv. 3 e 5
    .replace(/(?<![\p{L}\p{N}])(?:vv|vs)\.?\s*(\d+)\s*(?:[-–—]|a|até)\s*(\d+)/giu, "versículos $1 a $2")
    .replace(/(?<![\p{L}\p{N}])(?:vv|vs)\.?\s*(\d+)\s*(?:e|,)\s*(\d+)/giu, "versículos $1 e $2")
    // a single verse: v. 16, v16, v 16, vs. 16
    .replace(/(?<![\p{L}\p{N}])(?:v|vs)\.?\s*(\d+)\s*[-–—]\s*(\d+)/giu, "versículos $1 a $2")
    .replace(/(?<![\p{L}\p{N}])(?:vv|v|vs)\.?\s*(\d+)/giu, "versículo $1");
}

export function applyLexicon(text: string): string {
  let out = text;
  for (const [word, respell] of Object.entries(lexicon.entries as Record<string, string>)) {
    if (word === respell) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "gu"), respell);
  }
  return out;
}

export function prepareForSpeech(text: string): string {
  return applyLexicon(expandVerseMarkers(expandReferencesForSpeech(text))).replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
}

/** Splits into sentences, keeping very short ones attached to the next. */
export function splitSentences(text: string, minLen = 25): string[] {
  const raw = text.match(/[^.!?…]+[.!?…]+["”')\]]*\s*|[^.!?…]+$/g) ?? [text];
  const out: string[] = [];
  let carry = "";
  for (const s of raw.map((x) => x.trim()).filter(Boolean)) {
    const cur = carry ? `${carry} ${s}` : s;
    if (cur.length < minLen) carry = cur;
    else {
      out.push(cur);
      carry = "";
    }
  }
  if (carry) {
    if (out.length) out[out.length - 1] += ` ${carry}`;
    else out.push(carry);
  }
  return out;
}

/** Hint for the speech recognizer (Whisper `prompt`): biblical names and theological terms. */
export function recognitionVocabulary(max = 120): string[] {
  return (lexicon.vocabulary as string[]).slice(0, max);
}

/**
 * The first clip decides how soon the voice starts, and the narrator voice needs about one second of work per second of speech:
 * when the first sentence is longer than `maxWords`, its first phrase (3 to 8 words, up to a comma, semicolon or colon) goes alone and the rest follows right behind.
 */
export function shortFirstChunk(sentences: string[], maxWords = 9): string[] {
  const first = sentences[0];
  if (!first || first.split(/\s+/).length <= maxWords) return sentences;
  const m = /^(\S+(?:\s+\S+){2,7}?[,;:])\s+([\s\S]+)$/.exec(first);
  return m ? [m[1], m[2], ...sentences.slice(1)] : sentences;
}
