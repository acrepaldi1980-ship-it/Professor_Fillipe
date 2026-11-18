// Minimal USFM reader for eBible.org files: extracts verse text per chapter, drops notes and markup.
export interface ParsedVerse {
  book: string; // USFM/OSIS book code (matches lib/knowledge/books.ts for the 66 canonical books)
  chapter: number;
  verse: number;
  text: string;
}

const SKIP_LINE = /^\\(id|ide|h|toc\d|mt\d?|ms\d?|mr|s\d?|sr|r|d|sp|rem|cl|cd|imt\d?|is\d?|ip|iot|io\d?|ie|periph|restore|usfm|sts|mte\d?)\b/;

export function cleanVerseText(raw: string): string {
  return raw
    .replace(/\\f\s[\s\S]*?\\f\*/g, "") // footnotes
    .replace(/\\x\s[\s\S]*?\\x\*/g, "") // cross references
    .replace(/\\fig\s[\s\S]*?\\fig\*/g, "")
    .replace(/\\\+?(w|wg|wh|wa)\s+([^|\\]*?)(\|[^\\]*)?\\\+?\1\*/g, "$2") // \w word|strong="G1"\w*
    .replace(/\\\+?[a-z]+\d*\*?/gi, "") // remaining markers: \add \nd \wj \q1 \p \b ...
    .replace(/\s+/g, " ")
    .trim();
}

export function parseUsfm(content: string): ParsedVerse[] {
  const out: ParsedVerse[] = [];
  let book = "";
  let chapter = 0;
  let verse = 0;
  let buf: string[] = [];

  const flush = () => {
    if (book && chapter > 0 && verse > 0 && buf.length) {
      const text = cleanVerseText(buf.join(" "));
      if (text) out.push({ book, chapter, verse, text });
    }
    buf = [];
  };

  for (const line of content.split(/\r?\n/)) {
    const idm = line.match(/^\\id\s+([A-Z0-9]{3})/);
    if (idm) {
      flush();
      book = idm[1];
      chapter = 0;
      verse = 0;
      continue;
    }
    const cm = line.match(/^\\c\s+(\d+)/);
    if (cm) {
      flush();
      chapter = Number(cm[1]);
      verse = 0;
      continue;
    }
    const vm = line.match(/^\\v\s+(\d+)(?:[-,]\d+)?[a-z]?\s*(.*)$/);
    if (vm) {
      flush();
      verse = Number(vm[1]);
      buf = [vm[2]];
      continue;
    }
    if (SKIP_LINE.test(line)) continue;
    if (verse > 0) buf.push(line);
  }
  flush();
  return out;
}
