// Plain-text works of the Christian Classics Ethereal Library (public-domain texts with CCEL's layout): headings are flush left or lightly indented, the body
// is indented further. This turns one into entries (heading + body) and then into chunks, merging very short dictionary entries so that the many tiny
// entries do not each cost a whole database row.
export interface Entry { heading: string; body: string }

const SEP = /^\s*_{10,}\s*$/;
const NOISE = /^\s*(Image of page [ivxlcdm\d]+|\[\s*Page [^\]]*\]|Go to .*|Next .*|Previous .*)\s*$/i;
const indentOf = (l: string) => l.length - l.trimStart().length;

export function parseCcel(raw: string): Entry[] {
  let text = raw.replace(/\r/g, "");
  // CCEL ends with a long list of links ("References", then "1. file:///...")
  const refAt = text.search(/\n\s*References\s*\n\s*\n?\s*1\.\s+(?:file:|https?:)/);
  if (refAt > 0) text = text.slice(0, refAt);
  let lines = text.split("\n").filter((l) => !SEP.test(l) && !NOISE.test(l) && !/^\s*\d+\.\s+(?:file:|https?:)/.test(l));
  // skip the title page: everything up to the last rule among the first lines
  const rules = text.split("\n").slice(0, 90).map((l, i) => (SEP.test(l) ? i : -1)).filter((i) => i >= 0);
  if (rules.length) { const cut = text.split("\n").slice(0, rules[rules.length - 1] + 1).filter((l) => !SEP.test(l) && !NOISE.test(l)).length; lines = lines.slice(cut); }
  // the usual indent of the body
  const hist = new Map<number, number>();
  for (const l of lines) if (l.trim().length > 25) hist.set(indentOf(l), (hist.get(indentOf(l)) ?? 0) + 1);
  const body = [...hist].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 3;
  const out: Entry[] = [];
  let heading: string[] = [], bodyLines: string[] = [], inBody = false;
  const flush = () => { const b = bodyLines.join(" ").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim(); if (heading.length && b.length > 15) out.push({ heading: heading.join(" ").replace(/\s+/g, " ").trim().replace(/\[\d+\]/g, ""), body: b }); heading = []; bodyLines = []; inBody = false; };
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (indentOf(l) < body && t.length < 120 && !/^[+\-*•]\s/.test(t)) { // a heading
      if (/^[A-Z]$/.test(t)) continue; // the letter dividers of dictionaries
      if (inBody) flush();
      heading.push(t);
    } else if (heading.length || inBody) { bodyLines.push(t); inBody = true; }
  }
  flush();
  return out;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Dictionary entries shorter than `min` words are grouped with their neighbors (up to `max` words); the group's heading lists its first and last entries. */
export function groupShort(entries: Entry[], min = 70, max = 380): Entry[] {
  const out: Entry[] = [];
  let cur: Entry[] = [];
  const flush = () => { if (!cur.length) return; out.push({ heading: cur.length === 1 ? cur[0].heading : `${cur[0].heading} … ${cur[cur.length - 1].heading}`, body: cur.map((e) => (cur.length === 1 ? e.body : `${e.heading}: ${e.body}`)).join(" ") }); cur = []; };
  for (const e of entries) {
    if (words(e.body) >= min) { flush(); out.push(e); continue; }
    if (cur.length && words(cur.map((x) => x.body).join(" ")) + words(e.body) > max) flush();
    cur.push(e);
  }
  flush();
  return out;
}

/** "Rom. 10. 17" (chapter, period, verse) → "Rom. 10:17", as old commentaries cite. */
export const colonCites = (s: string) => s.replace(/\b((?:[1-3]\s)?[A-Z][a-z]{1,9}\.?)\s(\d{1,3})\.\s(\d{1,3})(?!\d)/g, "$1 $2:$3");

/** Jamieson-Fausset-Brown: BOOK NAME, CHAPTER n, and verse-range headings ("Ge 1:1, 2. The Creation of Heaven and Earth.") followed by notes. */
export function parseJfb(raw: string): Entry[] {
  const text = raw.replace(/\r/g, "");
  const cut = text.search(/\n\s*References\s*\n\s*\n?\s*1\.\s+(?:file:|https?:)/);
  const lines = (cut > 0 ? text.slice(0, cut) : text).split("\n").filter((l) => !SEP.test(l) && !/^\s*\d+\.\s+(?:file:|https?:)/.test(l));
  const out: Entry[] = [];
  let book = "", chapter = "", heading = "", buf: string[] = [];
  const flush = () => { const b = buf.join(" ").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim(); if (b.length > 40) out.push({ heading: [book, chapter, heading].filter(Boolean).join(" ").trim(), body: b }); buf = []; };
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (/^[A-Z][A-Z .,'-]{3,60}$/.test(t) && !/^CHAPTER/.test(t) && t.length > 3) { flush(); heading = ""; chapter = ""; book = t.replace(/\.$/, ""); continue; }
    const ch = /^CHAPTER (\d+)$/.exec(t);
    if (ch) { flush(); chapter = `chapter ${ch[1]}`; heading = ""; continue; }
    if (/^(?:[1-3]\s?)?[A-Z][a-z]{1,4}\.? \d+:\d+[^.]{0,40}\.\s+[A-Z]/.test(t) && t.length < 140) { flush(); heading = t; continue; }
    buf.push(t);
  }
  flush();
  return out;
}

/** Works whose headings are lines like "Chapter III.--Title" or "Book II" at the same indent as the text (Nicene and Post-Nicene Fathers, Schaff). */
export function parseChaptered(raw: string): Entry[] {
  const text = raw.replace(/\r/g, "");
  const cut = text.search(/\n\s*References\s*\n\s*\n?\s*1\.\s+(?:file:|https?:)/);
  const lines = (cut > 0 ? text.slice(0, cut) : text).split("\n").filter((l) => !SEP.test(l) && !NOISE.test(l) && !/^\s*\d+\.\s+(?:file:|https?:)/.test(l));
  const out: Entry[] = [];
  let book = "", head: string[] = [], buf: string[] = [], inHead = false;
  const flush = () => { const b = buf.join(" ").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim(); if (b.length > 80) out.push({ heading: [book, head.join(" ").replace(/\s+/g, " ").trim()].filter(Boolean).join(" > "), body: b }); buf = []; };
  for (const l of lines) {
    const t = l.trim();
    if (!t) { inHead = false; continue; }
    const bk = /^(?:BOOK|Book)\s+([IVXL]+|\d+)\b\.?\s*(.*)$/.exec(t);
    if (bk && t.length < 90 && indentOf(l) <= 4) { flush(); book = `Book ${bk[1]}${bk[2] ? ` ${bk[2]}` : ""}`.trim(); head = []; inHead = false; continue; }
    if (/^Chapter\s+[IVXLC\d]+\b/.test(t) && indentOf(l) <= 4) { flush(); head = [t]; inHead = true; continue; }
    if (inHead && t.length < 140) { head.push(t); continue; }
    buf.push(t);
  }
  flush();
  return out;
}
