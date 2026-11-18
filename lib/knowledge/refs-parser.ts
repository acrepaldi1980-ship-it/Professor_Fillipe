// Bible reference parser (spec 8.10.5). Understands pt-BR and English names and abbreviations,
// and converts them to canonical OSIS-style references, e.g. "1CO.13.4-1CO.13.7".
import { ALIASES, BOOK_BY_CODE } from "./books";

export interface ParsedReference {
  /** Text as it appeared in the input. */
  raw: string;
  /** Start offset in the input. */
  index: number;
  length: number;
  /** Canonical references: "JHN.3.16", "1CO.13.4-1CO.13.7", "PSA.23" (whole chapter), "GEN.1-GEN.3". */
  refs: string[];
  /** True when the chapter is out of range for the book (e.g. "João 40"); refs is then empty. */
  invalid: boolean;
}

const SINGLE_CHAPTER = new Set(["OBA", "PHM", "2JN", "3JN", "JUD"]);

/** Length-preserving normalization: lowercase, accents removed, "Jó" -> "jb" (so it does not clash with "Jo"). */
function normalize(text: string): string {
  const withJob = text.replace(/(^|[^\p{L}\p{N}])([Jj])[óÓ](?![\p{L}])/gu, "$1$2b");
  let out = "";
  for (const ch of withJob) {
    const base = ch.normalize("NFD")[0] ?? ch;
    out += base.toLowerCase();
  }
  return out;
}

const aliasKeys = [...ALIASES.keys()].sort((a, b) => b.length - a.length);
const aliasPattern = aliasKeys.map((a) => a.replace(/ /g, "\\s+")).join("|");
const PREFIX_WORDS: Record<string, number> = {
  i: 1, ii: 2, iii: 3,
  primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3,
  first: 1, second: 2, third: 3,
};

// [1] digit prefix, [2] word/roman prefix, [3] book alias, [4] chapter digits
const HEAD = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:(?:([123])[ºª°]?\\.?\\s*(?:de\\s+|of\\s+)?)|(?:(iii|ii|i|primeir[ao]|segund[ao]|terceir[ao]|first|second|third)\\s+(?:de\\s+|of\\s+)?))?(" +
    aliasPattern +
    ")\\.?(?![\\p{L}])\\s*(\\d+)",
  "gu",
);

// Range separators: dashes, or the words "a", "ao", "até", "to" ("João 3:17 a 3:40").
const DASH = "(?:[-–—]|\\s(?:a|ao|até|ate|to)\\s)";
const SEP_VERSE_COLON = /\s*(?::|\bvv?\.?)\s*(?=\d)/y;
const SEP_VERSE_ADJ = /[.,](?=\d)/y;
const NUM = /(\d+)/y;
const DASH_NUM = new RegExp(`\\s*${DASH}\\s*(\\d+)`, "y");
const CROSS = new RegExp(`\\s*${DASH}\\s*(\\d+)\\s*:\\s*(\\d+)`, "y");
const LIST_SEP = /\s*(?:,|\be\b|\band\b|&)\s*(?=\d)/y;
const SEMI_CH = /\s*;\s*(?=\d+\s*:)/y;
const COLON = /\s*:\s*/y;

function sticky(re: RegExp, s: string, pos: number): RegExpExecArray | null {
  re.lastIndex = pos;
  return re.exec(s);
}

function v(book: string, c: number, vs: number) {
  return `${book}.${c}.${vs}`;
}

function resolveBook(alias: string, prefix: number | null): { code: string; usedPrefix: boolean } | null {
  const target = ALIASES.get(alias.replace(/\s+/g, " "));
  if (!target) return null;
  if (prefix && target.fam) {
    const code = target.fam[prefix - 1];
    return code ? { code, usedPrefix: true } : null;
  }
  if (target.single) return { code: target.single, usedPrefix: false };
  return null; // numbered book written without number (e.g. "Coríntios 13")
}

interface Segment {
  refs: string[];
  end: number;
  invalid: boolean;
}

/** Parses what follows the chapter number, starting at `pos` (just after the chapter digits). */
function parseTail(norm: string, book: string, chapter: number, pos: number): Segment {
  const max = BOOK_BY_CODE[book].chapters;
  const refs: string[] = [];
  let invalid = false;
  let p = pos;

  const addChapterFirst = (c: number) => {
    if (c < 1 || c > max) invalid = true;
  };

  let cur = chapter;
  let hasVerses = false;

  // Single-chapter books: "Judas 3" means verse 3.
  const sepColon = sticky(SEP_VERSE_COLON, norm, p);
  const sepAdj = sepColon ? null : sticky(SEP_VERSE_ADJ, norm, p);
  const sep = sepColon ?? sepAdj;
  if (!sep && SINGLE_CHAPTER.has(book)) {
    // "Fm 4-6" / "Jd 3": chapter number is really the verse.
    let end = p;
    const dn = sticky(DASH_NUM, norm, p);
    if (dn) {
      end = dn.index + dn[0].length;
      return { refs: [`${book}.1.${chapter}-${book}.1.${dn[1]}`], end, invalid: false };
    }
    return { refs: [v(book, 1, chapter)], end, invalid: false };
  }

  if (sep) {
    hasVerses = true;
    p = sep.index + sep[0].length;
    addChapterFirst(cur);
    // verse list (with ranges), possibly followed by "; c:v..." continuations
    for (;;) {
      const n = sticky(NUM, norm, p);
      if (!n) break;
      const v1 = Number(n[1]);
      p = n.index + n[0].length;
      const cross = sticky(CROSS, norm, p);
      if (cross) {
        const c2 = Number(cross[1]);
        const v2 = cross[2];
        if (c2 < 1 || c2 > max) invalid = true;
        refs.push(`${v(book, cur, v1)}-${v(book, c2, Number(v2))}`);
        p = cross.index + cross[0].length;
        cur = c2;
      } else {
        const dn = sticky(DASH_NUM, norm, p);
        if (dn && !/^\s*:/.test(norm.slice(dn.index + dn[0].length))) {
          refs.push(`${v(book, cur, v1)}-${v(book, cur, Number(dn[1]))}`);
          p = dn.index + dn[0].length;
        } else {
          refs.push(v(book, cur, v1));
        }
      }
      const ls = sticky(LIST_SEP, norm, p);
      if (ls) {
        // "3:16, 4:2" would be a new chapter:verse, but we only treat numbers as verses here.
        const ahead = sticky(NUM, norm, ls.index + ls[0].length);
        if (ahead) {
          const after = ahead.index + ahead[0].length;
          if (sticky(COLON, norm, after)) break; // "x, 4:2" -> let caller stop (rare)
        }
        p = ls.index + ls[0].length;
        continue;
      }
      const semi = sticky(SEMI_CH, norm, p);
      if (semi) {
        const nc = sticky(NUM, norm, semi.index + semi[0].length);
        if (nc) {
          cur = Number(nc[1]);
          addChapterFirst(cur);
          const col = sticky(COLON, norm, nc.index + nc[0].length);
          if (col) {
            p = col.index + col[0].length;
            continue;
          }
        }
      }
      break;
    }
    if (refs.length === 0) hasVerses = false;
  }

  if (!hasVerses) {
    // whole chapter or chapter range
    p = pos;
    if (chapter < 1 || chapter > max) return { refs: [], end: pos, invalid: true };
    const dn = sticky(DASH_NUM, norm, p);
    if (dn) {
      const c2 = Number(dn[1]);
      if (c2 >= chapter && c2 <= max) {
        return { refs: [`${book}.${chapter}-${book}.${c2}`], end: dn.index + dn[0].length, invalid: false };
      }
      if (c2 > max) return { refs: [], end: dn.index + dn[0].length, invalid: true };
    }
    return { refs: [`${book}.${chapter}`], end: pos, invalid: false };
  }

  return { refs: invalid ? [] : refs, end: p, invalid };
}

/** Finds every Bible reference in free text. */
export function findReferences(text: string, opts: { strictCase?: boolean } = {}): ParsedReference[] {
  const norm = normalize(text);
  const out: ParsedReference[] = [];
  HEAD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEAD.exec(norm))) {
    const prefixNum = m[1] ? Number(m[1]) : m[2] ? PREFIX_WORDS[m[2]] : null;
    const alias = m[3];
    const resolved = resolveBook(alias, prefixNum);
    if (!resolved) continue;

    // Start of the reference: drop the prefix if it was not used (e.g. "1 Sl 23").
    let start = m.index;
    if (prefixNum && !resolved.usedPrefix) {
      const aliasStart = norm.indexOf(alias, m.index);
      start = aliasStart >= 0 ? aliasStart : m.index;
    }
    // In free text, very short abbreviations must be capitalized to avoid false positives ("os 3 homens").
    if (opts.strictCase && alias.length <= 2 && !resolved.usedPrefix) {
      const first = text[start];
      if (!first || first !== first.toUpperCase() || first === first.toLowerCase()) continue;
    }

    const chapter = Number(m[4]);
    const chapterEnd = m.index + m[0].length;
    const seg = parseTail(norm, resolved.code, chapter, chapterEnd);
    const end = Math.max(seg.end, chapterEnd);
    out.push({
      raw: text.slice(start, end).trim(),
      index: start,
      length: end - start,
      refs: seg.refs,
      invalid: seg.invalid,
    });
    HEAD.lastIndex = end;
  }
  return out;
}

/** Strict parse of a string that is exactly one reference. Returns canonical refs or null. */
export function parseReference(text: string): string[] | null {
  const t = text.trim();
  const found = findReferences(t);
  if (found.length !== 1) return null;
  const f = found[0];
  if (f.invalid || f.refs.length === 0) return null;
  // Everything must be consumed (ignoring a trailing period).
  const rest = t.slice(f.index + f.length).replace(/[.\s]+$/g, "");
  if (f.index !== 0 || rest.length > 0) return null;
  return f.refs;
}

/** Human-readable label for a canonical ref, in pt-BR. "JHN.3.16" -> "João 3:16". */
export function formatRefPt(ref: string): string {
  const [a, b] = ref.split("-");
  const fmt = (r: string) => {
    const [code, c, vs] = r.split(".");
    const name = BOOK_BY_CODE[code]?.pt ?? code;
    return { name, c, vs };
  };
  const x = fmt(a);
  const base = x.vs ? `${x.name} ${x.c}:${x.vs}` : `${x.name} ${x.c}`;
  if (!b) return base;
  const y = fmt(b);
  if (y.name === x.name) {
    if (!x.vs) return `${base}-${y.c}`;
    return y.c === x.c ? `${base}-${y.vs}` : `${base}-${y.c}:${y.vs}`;
  }
  return `${base}-${y.name} ${y.c}${y.vs ? ":" + y.vs : ""}`;
}

/**
 * Expands canonical refs to verse level so exact-reference search can match overlaps:
 * "ACT.8.26-ACT.8.28" -> ACT.8.26, ACT.8.27, ACT.8.28. Cross-chapter ranges keep both endpoints.
 * Every verse also adds its chapter key ("ACT.8") so chapter-level mentions match too.
 */
export function expandRefs(refs: string[], maxSpan = 200): string[] {
  const out = new Set<string>();
  for (const ref of refs) {
    const [a, b] = ref.split("-");
    const [bk, ch, vs] = a.split(".");
    if (!b) {
      out.add(ref);
      if (vs) out.add(`${bk}.${ch}`);
      continue;
    }
    const [bk2, ch2, vs2] = b.split(".");
    if (bk === bk2 && ch === ch2 && vs && vs2) {
      const from = Number(vs);
      const to = Math.min(Number(vs2), from + maxSpan);
      for (let n = from; n <= to; n++) out.add(`${bk}.${ch}.${n}`);
      out.add(`${bk}.${ch}`);
    } else {
      out.add(a);
      out.add(b);
      if (vs) out.add(`${bk}.${ch}`);
      if (vs2) out.add(`${bk2}.${ch2}`);
      if (!vs && !vs2 && bk === bk2) {
        // chapter range: GEN.1-GEN.3 -> GEN.1, GEN.2, GEN.3
        for (let c = Number(ch); c <= Number(ch2) && c - Number(ch) <= maxSpan; c++) out.add(`${bk}.${c}`);
      }
    }
  }
  return [...out];
}
