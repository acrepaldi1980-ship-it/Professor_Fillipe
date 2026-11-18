// Quick manual check of hybrid search. Usage: tsx scripts/search-smoke.ts "Quem foi Barnabé?"
import { getVerses, searchChunks } from "../lib/knowledge/search";
import { formatRefPt } from "../lib/knowledge/refs-parser";

async function main() {
  const queries = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["Quem foi Barnabé?", "O que havia dentro da Arca da Aliança?", "Quem era o eunuco etíope em Atos 8?", "Por que Elias fugiu de Jezabel?", "Me mostra João 3:17 a 3:40"];
  for (const q of queries) {
    const t0 = Date.now();
    const { chunks, refs } = await searchChunks(q);
    console.log(`\n# ${q}  (${Date.now() - t0} ms, refs: ${refs.join(",") || "-"})`);
    for (const c of chunks.slice(0, 5)) {
      console.log(`  [${c.signals.join("+")}] L${c.layer} ${c.score.toFixed(4)} ${c.work_id} :: ${(c.title_path ?? "").slice(0, 60)} :: ${c.text.replace(/\s+/g, " ").slice(0, 80)}`);
    }
    const exact = refs.filter((r) => r.split(".").length === 3).slice(0, 25);
    if (exact.length) {
      const verses = await getVerses("por_blivre_2018", exact);
      const found = new Set(verses.map((v) => v.ref));
      const missing = exact.filter((r) => !found.has(r));
      console.log(`  verses found: ${found.size}; missing in por_blivre_2018: ${missing.map((m) => formatRefPt(m)).join(", ") || "none"}`);
    }
  }
}
main();
