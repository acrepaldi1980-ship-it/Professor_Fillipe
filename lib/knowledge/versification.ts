// Parser of the condensed STEPBible TVTMS table: which verse numbers differ between the English (KJV), Hebrew, Latin and
// Greek traditions. Pure functions, so they are testable without the data files.
export type Tradition = "heb" | "lat" | "grc";
export interface MapRow {
  tradition: Tradition;
  ref: string;
  engRef: string;
}

const BOOK_RE = /^([1-3A-Za-z]{3})\.(\d+):(\d+)(?:-(\d+))?$/;

function expand(spec: string): string[] | null {
  const m = BOOK_RE.exec(spec.trim());
  if (!m) return null; // titles, "Absent [...]", cross-chapter ranges and sub-verses are skipped
  const [, book, ch, a, b] = m;
  const from = +a;
  const to = b ? +b : from;
  if (to < from || to - from > 200) return null;
  const out: string[] = [];
  for (let v = from; v <= to; v++) out.push(`${book.toUpperCase()}.${+ch}.${v}`);
  return out;
}

/** Lines of the condensed section: type, English KJV, Hebrew, Latin, Greek (tab separated). Only differing verses are kept. */
export function parseTvtmsCondensed(lines: string[]): MapRow[] {
  const rows = new Map<string, MapRow>();
  for (const line of lines) {
    const c = line.split("\t");
    if (!/^(OneToOne|SubdividedVerse|MergedPrevVerse|Merged|Renumber\w*)$/.test(c[0] ?? "")) continue;
    const eng = expand(c[1] ?? "");
    if (!eng) continue;
    for (const [tradition, col] of [["heb", 2], ["lat", 3], ["grc", 4]] as [Tradition, number][]) {
      const other = expand(c[col] ?? "");
      if (!other || other.length !== eng.length) continue;
      eng.forEach((e, i) => {
        if (other[i] === e) return;
        const key = `${tradition}|${other[i]}`;
        if (!rows.has(key)) rows.set(key, { tradition, ref: other[i], engRef: e });
      });
    }
  }
  return [...rows.values()];
}

/** The English-numbering reference for a verse of another tradition (or the same reference when numbering agrees). */
export function toEnglish(map: MapRow[], tradition: Tradition, ref: string): string {
  return map.find((r) => r.tradition === tradition && r.ref === ref)?.engRef ?? ref;
}
