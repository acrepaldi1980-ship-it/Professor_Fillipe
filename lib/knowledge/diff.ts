// Word-level difference between two renderings of the same verse (comparison of versions, spec 8.7.4 P1): which words of version B are not in A.
export interface Seg { text: string; changed: boolean }

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "");

/** Splits `b` into segments marking the words that do not appear (in order) in `a` (longest common subsequence on normalized words). */
export function diffWords(a: string, b: string): Seg[] {
  const wa = a.split(/\s+/).filter(Boolean), wb = b.split(/\s+/).filter(Boolean);
  const na = wa.map(norm), nb = wb.map(norm);
  const n = na.length, m = nb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = na[i] && na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const same = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (na[i] && na[i] === nb[j]) { same[j] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const out: Seg[] = [];
  wb.forEach((w, k) => {
    const changed = !same[k] && !!nb[k];
    const last = out[out.length - 1];
    if (last && last.changed === changed) last.text += " " + w; else out.push({ text: w, changed });
  });
  return out;
}

/** Share of words of b that differ from a (0..1), to tell a paraphrase from a close rendering. */
export function difference(a: string, b: string): number {
  const segs = diffWords(a, b);
  const total = segs.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  const diff = segs.filter((s) => s.changed).reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  return total ? diff / total : 0;
}
