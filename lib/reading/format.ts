// Pure helpers of the reader screen: how a selection of verses is named ("João 3:16-18, 20") and the text that is shared.
import { formatRefPt } from "../knowledge/refs-parser";

const parts = (ref: string) => { const [b, c, v] = ref.split("."); return { b, c: Number(c), v: Number(v) }; };

/** Groups verse references of one chapter into runs: ["JHN.3.16","JHN.3.17","JHN.3.20"] -> [["JHN.3.16","JHN.3.17"],["JHN.3.20"]]. References of different chapters are never joined. */
export function runsOf(refs: string[]): string[][] {
  const sorted = [...new Set(refs)].sort((a, b) => { const x = parts(a), y = parts(b); return x.b === y.b ? (x.c - y.c) || (x.v - y.v) : 0; });
  const out: string[][] = [];
  for (const r of sorted) {
    const last = out.at(-1)?.at(-1);
    const p = parts(r), q = last ? parts(last) : null;
    if (q && q.b === p.b && q.c === p.c && p.v === q.v + 1) out.at(-1)!.push(r); else out.push([r]);
  }
  return out;
}

/** "João 3:16-18, 20" (Portuguese book names). */
export function labelOf(refs: string[]): string {
  const runs = runsOf(refs);
  if (!runs.length) return "";
  const first = parts(runs[0][0]);
  const chunks = runs.map((run, i) => {
    const a = parts(run[0]), z = parts(run[run.length - 1]);
    const range = run.length > 1 ? `${a.v}-${z.v}` : `${a.v}`;
    if (i === 0) return formatRefPt(`${a.b}.${a.c}.${a.v}`).replace(/:\d+$/, `:${range}`);
    return a.b === first.b && a.c === first.c ? range : formatRefPt(`${a.b}.${a.c}.${a.v}`).replace(/:\d+$/, `:${range}`);
  });
  return chunks.join(", ");
}

/** The text to share: the verses, the reference and the version (the credit travels with the text), and where to read more. */
export function shareText(verses: { ref: string; text: string }[], versionName: string): string {
  const refs = verses.map((v) => v.ref);
  const body = verses.length === 1 ? verses[0].text : verses.map((v) => `${v.ref.split(".")[2]} ${v.text}`).join(" ");
  return `“${body.trim()}”\n— ${labelOf(refs)} (${versionName})`;
}

/** Verses that are all read -> the chapter is read. */
export const chapterIsRead = (read: Set<string>, chapterRefs: string[]) => chapterRefs.length > 0 && chapterRefs.every((r) => read.has(r));
