// Turns the plain texts of the historians (Project Gutenberg and CCEL, public domain) into reading units: a chapter, a letter or a block of a life, in order,
// each with a label that locates it exactly (HE 3.39, Cartas 97, Cláudio 3). Where the translation has no chapter numbers, blocks of about 350 words are numbered.
export interface Unit { part: string; label: string; title: string; text: string }

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\[\d+\]/g, "").replace(/\(\d+\)/g, "").replace(/\s+/g, " ").trim();
const fromRoman = (r: string): number => { const m: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; return [...r.toUpperCase()].reduce((t, ch, i, a) => (m[ch] < (m[a[i + 1]] ?? 0) ? t - m[ch] : t + m[ch]), 0); };

/** Paragraph blocks of about `size` words, keeping paragraphs whole. */
export function blocks(text: string, size = 350): string[] {
  const out: string[] = []; let cur: string[] = [], w = 0;
  for (const p of text.split(/\n\s*\n/).map(clean).filter((x) => x.length > 0)) {
    const k = words(p);
    if (cur.length && w + k > size) { out.push(cur.join("\n\n")); cur = []; w = 0; }
    cur.push(p); w += k;
  }
  if (cur.length) out.push(cur.join("\n\n"));
  return out;
}

/** Eusebius (NPNF II.1): "Book III." and "Chapter XXXIX.--Title" lines; the range of lines picks the work inside the volume. */
export function parseBookChapter(raw: string, from: number, to: number, cite: string): Unit[] {
  const lines = raw.replace(/\r/g, "").split("\n").slice(from - 1, to);
  const out: Unit[] = [];
  let book = 0, chap = "", title = "", buf: string[] = [], head = false;
  const flush = () => { const t = buf.join("\n").split(/\n\s*\n/).filter((p) => !/^\s*\[\d+\]/.test(p)).join("\n\n"); if (chap && words(t) > 25) out.push({ part: `Livro ${book}`, label: `${cite} ${book}.${chap}`, title: title.replace(/\s+/g, " ").trim(), text: t.split(/\n\s*\n/).filter((p) => !/^\s*\[\d+\]/.test(p)).map(clean).filter(Boolean).join("\n\n") }); buf = []; };
  for (const l of lines) {
    const t = l.trim();
    const b = /^Book\s+([IVX]+)\.?$/i.exec(t);
    if (b && /^\s{0,4}\S/.test(l)) { flush(); book = fromRoman(b[1]); chap = ""; continue; }
    const c = /^Chapter\s+([IVXLC]+)\.?\s*[-—–]*\s*(.*)$/i.exec(t);
    if (c && /^\s{0,4}\S/.test(l)) { flush(); chap = String(fromRoman(c[1])); title = c[2]; head = true; continue; }
    if (head) { if (!t) { head = false; continue; } if (t.length < 90 && !/[.]$/.test(title)) { title += ` ${t}`; continue; } head = false; }
    if (chap) buf.push(l.replace(/^ {3}/, ""));
  }
  flush();
  return out.filter((u) => u.part !== "Livro 0");
}

/** Pliny's letters ("XCVII -- To THE EMPEROR TRAJAN"): a new book starts when the Roman numbering drops. The table of contents (headings without text) is skipped. */
export function parseLetters(raw: string, cite: string): Unit[] {
  const lines = raw.replace(/\r/g, "").split("\n");
  const heads: { i: number; n: number; title: string }[] = [];
  lines.forEach((l, i) => { const m = /^([IVXLC]+)\s*(?:--|—|–)?\s*(To\b.*|TRAJAN TO .*)$/i.exec(l.trim()); if (m && l.trim().length < 90) heads.push({ i, n: fromRoman(m[1]), title: m[2] }); });
  const out: Unit[] = []; let book = 1, prev = 0;
  heads.forEach((h, k) => {
    const emperor = /TRAJAN/i.test(h.title);
    if (!emperor && h.n < prev - 10) book++;
    if (!emperor) prev = h.n;
    const body = lines.slice(h.i + 1, heads[k + 1]?.i ?? lines.length).join("\n");
    if (words(body) < 40) return;
    out.push({ part: emperor ? "Livro 10" : `Livro ${book}`, label: `${cite} ${emperor ? 10 : book}.${h.n}`, title: h.title.replace(/\s+/g, " "), text: body.split(/\n\s*\n/).map(clean).filter(Boolean).join("\n\n") });
  });
  return out;
}

/** "1. Germany is separated..." numbered chapters (Germany, Agricola). */
export function parseNumbered(raw: string, from: number, to: number, cite: string): Unit[] {
  const lines = raw.replace(/\r/g, "").split("\n").slice(from - 1, to);
  const out: Unit[] = []; let n = 0, buf: string[] = [];
  const flush = () => { const t = clean(buf.join(" ")); if (n && words(t) > 15) out.push({ part: "", label: `${cite} ${n}`, title: "", text: t }); buf = []; };
  let stop = false;
  for (const l of lines) { if (stop) break; const m = /^(\d{1,3})\.\s+(.*)$/.exec(l.trim()); if (m && Number(m[1]) === n + 1) { flush(); n = Number(m[1]); buf.push(m[2]); } else if (/^\[\d+\]\s+[A-Z_]/.test(l.trim()) && n >= 40) stop = true; else if (n && l.trim()) buf.push(l.trim()); }
  flush();
  return out;
}

/** Texts without chapter numbers: blocks of about 350 words, numbered inside each part. */
export function parseBlocks(raw: string, from: number, to: number, part: string, cite: string): Unit[] {
  const text = raw.replace(/\r/g, "").split("\n").slice(from - 1, to).join("\n");
  return blocks(text).map((b, i) => ({ part, label: `${cite} ${i + 1}`, title: "", text: b }));
}
