import { cosine, getEmbeddingProvider } from "../lib/knowledge/embeddings";

const passages = [
  "Barnabas, a Levite from Cyprus, was called the son of encouragement and accompanied Paul on his first missionary journey.",
  "The ark of the covenant was a chest overlaid with gold that held the tablets of the law.",
  "Philip the evangelist explained Isaiah to the Ethiopian eunuch on the road to Gaza.",
  "Elijah fled to Horeb after threats from Queen Jezebel.",
];
const queries: [string, number][] = [
  ["Quem foi Barnabé?", 0],
  ["O que havia dentro da Arca da Aliança?", 1],
  ["Quem explicou Isaías para o eunuco etíope?", 2],
  ["Por que Elias fugiu?", 3],
];

async function main() {
const p = getEmbeddingProvider();
const t0 = Date.now();
const pv = await p.embedPassages(passages);
console.log(`passages embedded in ${Date.now() - t0} ms (includes model load), dims=${pv[0].length}`);
let ok = 0;
for (const [q, want] of queries) {
  const t1 = Date.now();
  const qv = await p.embedQuery(q);
  const scores = pv.map((v) => cosine(qv, v));
  const best = scores.indexOf(Math.max(...scores));
  if (best === want) ok++;
  console.log(`${best === want ? "OK " : "BAD"} ${q} -> #${best} (${scores[best].toFixed(3)}) ${Date.now() - t1} ms`);
}
console.log(`${ok}/${queries.length} correct`);
}
main();
