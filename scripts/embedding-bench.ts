// Compares embedding models on Portuguese questions against English dictionary entries (Easton).
// Usage: tsx scripts/embedding-bench.ts
import { cosine, LocalE5Provider } from "../lib/knowledge/embeddings";
import { sql } from "./db.mjs";

const QUESTIONS: [string, string][] = [
  ["Quem foi Barnabé?", "barnabas"],
  ["O que havia dentro da Arca da Aliança?", "ark"],
  ["Por que Elias fugiu de Jezabel?", "elijah|jezebel"],
  ["Quem foi Nabucodonosor?", "nebuchadnezzar"],
  ["Quem era Melquisedeque?", "melchizedek"],
  ["O que é propiciação?", "propitiation"],
  ["O que é o Pentecostes?", "pentecost"],
  ["Quem era o eunuco etíope?", "eunuch|candace|ethiopia"],
  ["Quem eram os fariseus?", "pharisees"],
  ["Quem foi Mefibosete?", "mephibosheth"],
  ["O que é o Tabernáculo?", "tabernacle"],
  ["Quem foi Pôncio Pilatos?", "pilate"],
  ["O que é o batismo?", "baptism"],
  ["O que era a Páscoa?", "passover"],
  ["Quem foi Filipe, o evangelista?", "philip"],
];

async function main() {
  const rows: { id: string; title_path: string; text: string }[] = await sql("select id, title_path, text from chunks where work_id='easton_1897' order by id");
  console.log(`${rows.length} Easton chunks`);
  const models: [string, number][] = [
    ["Xenova/multilingual-e5-small", 384],
    ["Xenova/multilingual-e5-base", 768],
  ];
  for (const [model, dims] of models) {
    const p = new LocalE5Provider(model, dims);
    const t0 = Date.now();
    const texts = rows.map((r) => r.text.split(/\s+/).slice(0, 90).join(" "));
    const vecs = await p.embedPassages(texts);
    console.log(`${model}: embedded in ${Math.round((Date.now() - t0) / 1000)} s`);
    let hit = 0;
    for (const [q, expect] of QUESTIONS) {
      const qv = await p.embedQuery(q);
      const top = vecs
        .map((v, i) => ({ i, s: cosine(qv, v) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .map((x) => rows[x.i].title_path);
      const ok = top.some((t) => new RegExp(expect, "i").test(t));
      if (ok) hit++;
      console.log(`  ${ok ? "OK " : "MISS"} ${q} -> ${top.join(", ")}`);
    }
    console.log(`RESULT ${model}: ${hit}/${QUESTIONS.length} in top 5`);
  }
}
main();
