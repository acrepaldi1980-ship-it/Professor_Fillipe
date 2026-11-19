// Old books cite "John iii. 16" or "PSALM cxvi. 12, 13" (Roman chapter, then a period). This rewrites them to
// "John 3:16" so the Bible reference parser can read them when we extract references from library texts.
const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
const fromRoman = (r: string) => [...r.toLowerCase()].reduce((t, ch, i, a) => (ROMAN[ch] < (ROMAN[a[i + 1]] ?? 0) ? t - ROMAN[ch] : t + ROMAN[ch]), 0);

export function modernizeCitations(text: string): string {
  return text.replace(/\b((?:[1-3]|I{1,3})\s)?([A-Z][A-Za-z]{1,13})\.?\s+([ivxlcIVXLC]{1,7})\.\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g, (m, pre, book, rom, v1, v2) => {
    const ch = fromRoman(rom);
    if (!ch || ch > 150) return m;
    const name = book === book.toUpperCase() ? book.charAt(0) + book.slice(1).toLowerCase() : book;
    return `${pre ?? ""}${name} ${ch}:${v1}${v2 ? `-${v2}` : ""}`;
  });
}
