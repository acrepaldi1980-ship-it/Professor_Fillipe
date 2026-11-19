// Mouth opening driven by the text being spoken (RF-M17-02). The browser's speech engine gives no audio to measure, so we
// plan the mouth from the words: every syllable opens the mouth according to its vowel (a wide, e/o medium, i/u narrow)
// and closes between syllables and at punctuation pauses. The plan is re-aligned to the real speech whenever the engine
// reports a word boundary. Output is a "level" in 0..0.25 (the avatar multiplies it by 3.2).
export interface PlannedWord {
  start: number; // character index in the text
  startMs: number; // estimated start time (ms) from the beginning
  syll: { atMs: number; durMs: number; open: number }[];
  endMs: number;
}

const OPEN: Record<string, number> = { a: 1, á: 1, à: 1, â: 0.9, ã: 0.8, e: 0.7, é: 0.85, ê: 0.65, o: 0.7, ó: 0.85, ô: 0.6, õ: 0.6, i: 0.4, í: 0.4, u: 0.4, ú: 0.4, y: 0.4 };
const VOWEL = /[aàáâãeéêiíoóôõuúy]+/gi;

function syllablesOf(word: string): number[] {
  const out: number[] = [];
  for (const m of word.toLowerCase().matchAll(VOWEL)) {
    // a group like "ia" or "eu" is split in two openings only when it has 2+ strong vowels; otherwise one syllable
    const g = m[0];
    const strong = [...g].filter((c) => OPEN[c] >= 0.6);
    const peak = Math.max(...[...g].map((c) => OPEN[c] ?? 0.4));
    out.push(peak);
    if (strong.length >= 2) out.push(Math.max(...strong.map((c) => OPEN[c])) * 0.8);
  }
  return out.length ? out : [0.35];
}

export function planText(text: string, rate = 1): PlannedWord[] {
  const words: PlannedWord[] = [];
  const re = /[\p{L}\p{N}'’-]+/gu;
  let t = 0;
  let prevEnd = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    // pauses from the punctuation between the previous word and this one
    const gap = text.slice(prevEnd, idx);
    if (/[.!?…]/.test(gap)) t += 380 / rate;
    else if (/[,;:—–]/.test(gap)) t += 190 / rate;
    const sy = syllablesOf(m[0]);
    const per = 175 / rate;
    const startMs = t;
    const syll = sy.map((open, k) => ({ atMs: startMs + k * per, durMs: per * 0.8, open }));
    t = startMs + sy.length * per + (m[0].length > 7 ? 30 : 0) / rate + 25 / rate;
    words.push({ start: idx, startMs, syll, endMs: t });
    prevEnd = idx + m[0].length;
  }
  return words;
}

/** Mouth level at `ms` since the start of speech (already shifted by the caller to match the engine's boundaries). */
export function levelAt(plan: PlannedWord[], ms: number): number {
  for (const w of plan) {
    if (ms < w.startMs - 5 || ms > w.endMs) continue;
    for (const s of w.syll) {
      const x = (ms - s.atMs) / s.durMs;
      if (x >= 0 && x <= 1) return 0.23 * s.open * Math.sin(Math.PI * x) ** 0.8;
    }
  }
  return 0;
}

/** Index of the planned word that starts at (or just before) a character index. */
export function wordAt(plan: PlannedWord[], charIndex: number): number {
  let k = 0;
  for (let i = 0; i < plan.length; i++) if (plan[i].start <= charIndex) k = i;
  return k;
}
