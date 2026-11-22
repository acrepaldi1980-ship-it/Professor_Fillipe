// Structure of Josephus's works in Whiston's translation (public domain, Project Gutenberg): books, chapters and numbered sections, so the app can cite
// them the way scholars do: Ant. 18.3.3 (book.chapter.section), War 6.5.3, Life §65, Ap. 2.15. The four works hold the 30 books of Josephus
// that survive: Antiquities of the Jews (20), The Jewish War (7), Life (1) and Against Apion (2).
export type WorkKey = "ant" | "war" | "life" | "apion";
export interface Section { work: WorkKey; book: number; chapter: number; n: number; text: string }
export interface ChapterInfo { work: WorkKey; book: number; chapter: number; title: string }
export interface Parsed { sections: Section[]; chapters: ChapterInfo[] }

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
export const fromRoman = (r: string): number => [...r.toUpperCase()].reduce((t, ch, i, a) => (ROMAN[ch] < (ROMAN[a[i + 1]] ?? 0) ? t - ROMAN[ch] : t + ROMAN[ch]), 0);

export const WORKS: Record<WorkKey, { gutenberg: string; title: string; short: string; cite: string; books: number }> = {
  ant: { gutenberg: "2848", title: "Antiguidades Judaicas", short: "Antiguidades", cite: "Ant.", books: 20 },
  war: { gutenberg: "2850", title: "A Guerra dos Judeus", short: "Guerra", cite: "Guerra", books: 7 },
  life: { gutenberg: "2846", title: "Vida de Flávio Josefo", short: "Vida", cite: "Vida", books: 1 },
  apion: { gutenberg: "2849", title: "Contra Apião", short: "Contra Apião", cite: "Ap.", books: 2 },
};

/** "Ant. 18.3.3", "Guerra 6.5.3", "Vida 65", "Ap. 2.15". */
export function cite(work: WorkKey, book: number, chapter: number, n: number): string {
  const c = WORKS[work].cite;
  if (work === "life") return `${c} ${n}`;
  if (work === "apion") return `${c} ${book}.${n}`;
  return `${c} ${book}.${chapter}.${n}`;
}

const isBookLine = (l: string) => /^BOOK\s+([IVXL]+|\d+)\b/i.exec(l.trim());
const isChapterLine = (l: string) => /^CHAPTER\s+(\d+|[IVXL]+)\.?\s*(.*)$/i.exec(l.trim());
const isParaStart = (l: string) => /^(\d{1,3})\.\s+\S/.exec(l);

const isNoteStart = (l: string) => /^\d{1,3} \(return\) \[/.test(l);

/** Parses one Gutenberg text (already without the Gutenberg header and footer). Whiston's own footnotes ("2 (return) [ ... ]") are left out of the text. */
export function parseWork(work: WorkKey, text: string): Parsed {
  const lines = text.replace(/\r/g, "").split("\n");
  const secs = new Map<string, Section>();
  const titles = new Map<string, string>();
  let book = work === "ant" || work === "war" ? 0 : 1, chapter = work === "ant" || work === "war" ? 0 : 1; // the Preface comes before Book I
  let cur: Section | null = null;
  let title: { key: string; parts: string[]; open: boolean } | null = null;
  let lastParaN = 0, inNote = false, sub: 0 | 1 = 0, prefaceDone = false;
  const flush = () => { const c = cur as Section | null; if (c && c.text.trim()) { c.text = c.text.replace(/\s+/g, " ").trim(); secs.set(`${c.book}.${c.chapter}.${c.n}`, c); } cur = null; };
  const closeTitle = () => { if (title) { const t = title.parts.join(" ").replace(/\s+/g, " ").trim(); if (t) titles.set(title.key, t); title = null; } };
  const begin = (n: number, first: string) => { flush(); closeTitle(); lastParaN = n; cur = { work, book, chapter, n, text: first }; };

  for (const raw of lines) {
    const l = raw.replace(/<[^>]+>/g, "").trimEnd(), t = l.trim();
    if (inNote) { if (!t) inNote = false; continue; }
    if (isNoteStart(t)) { inNote = true; continue; }
    if (!t) { if (title) title.open = false; continue; }
    if (sub === 1) { if (isParaStart(t) || isChapterLine(t)) sub = 0; else continue; } // the subtitle of a book ("Containing the interval of ...")

    const bm = isBookLine(t);
    if (bm && t.length < 140 && work !== "life") {
      const n = /^\d+$/.test(bm[1]) ? Number(bm[1]) : fromRoman(bm[1]);
      if (n >= 1 && n <= WORKS[work].books && (n === book + 1 || n === 1 || n === book)) {
        flush(); closeTitle();
        if (n !== book || work === "apion") { book = n; chapter = work === "apion" ? 1 : 0; }
        lastParaN = 0; sub = 1;
        continue;
      }
    }
    const cm = isChapterLine(t);
    if (cm && work !== "apion" && work !== "life") {
      const ch = /^\d+$/.test(cm[1]) ? Number(cm[1]) : fromRoman(cm[1]);
      if (ch >= 1 && ch <= 40 && (ch > chapter || ch === 1 || ch === chapter) && cm[2].length < 200) {
        flush(); closeTitle();
        chapter = ch; lastParaN = 0;
        title = { key: `${book}.${chapter}`, parts: cm[2] ? [cm[2]] : [], open: true };
        continue;
      }
    }
    if (/^PREFACE(\.\d+)?$/.test(t) && (work === "ant" || work === "war") && !prefaceDone) { flush(); closeTitle(); book = 0; chapter = 0; lastParaN = 0; if ([...secs.keys()].some((k) => k.startsWith("0.0."))) prefaceDone = true; continue; }
    const pm = isParaStart(t);
    if (pm && (Number(pm[1]) === lastParaN + 1 || (lastParaN > 0 && Number(pm[1]) === lastParaN + 2))) { begin(Number(pm[1]), t.replace(/^\d{1,3}\.\s+/, "")); continue; }
    if (title && !cur && (title.open || (title.parts.length === 0 && /^\s/.test(l)))) { title.parts.push(t); title.open = true; continue; }
    if (cur) { (cur as Section).text += ` ${t}`; continue; }
    if (lastParaN === 0 && !(work !== "life" && work !== "apion" && book === 0 && chapter === 0 && secs.size === 0 && !title)) { begin(1, t); continue; } // a chapter without numbered paragraphs
  }
  flush(); closeTitle();

  const sections = [...secs.values()].sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.n - b.n);
  const seen = new Set<string>(); const chapters: ChapterInfo[] = [];
  for (const sx of sections) { const k = `${sx.book}.${sx.chapter}`; if (!seen.has(k)) { seen.add(k); chapters.push({ work, book: sx.book, chapter: sx.chapter, title: titles.get(k) ?? "" }); } }
  return { sections, chapters };
}
