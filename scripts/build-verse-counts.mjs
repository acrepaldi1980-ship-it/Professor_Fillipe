// Builds lib/reading/verse-counts.json: verses per chapter of every book (KJV versification, 31,102 verses), used for reading progress ("chapters read", "% of the book").
// Usage: node scripts/build-verse-counts.mjs <folder with the KJV USFM files>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const CODES = new Set(["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"]);
const out = {};
for (const f of readdirSync(dir).filter((x) => /\.(usfm|sfm)$/i.test(x))) {
  const t = readFileSync(`${dir}/${f}`, "utf8");
  const code = /\\id\s+([0-9A-Z]{3})/.exec(t)?.[1];
  if (!code || !CODES.has(code)) continue;
  const chapters = [];
  let ch = 0;
  for (const line of t.split(/\r?\n/)) {
    const c = /^\\c\s+(\d+)/.exec(line); if (c) { ch = Number(c[1]); chapters[ch - 1] = 0; continue; }
    const v = /\\v\s+(\d+)(?:-(\d+))?/g; let m;
    while ((m = v.exec(line)) && ch) chapters[ch - 1] += m[2] ? Number(m[2]) - Number(m[1]) + 1 : 1;
  }
  out[code] = chapters;
}
const total = Object.values(out).flat().reduce((a, b) => a + b, 0);
writeFileSync("lib/reading/verse-counts.json", JSON.stringify(out));
console.log(`${Object.keys(out).length} books, ${Object.values(out).flat().length} chapters, ${total} verses`);
