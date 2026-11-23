// Checks the Portuguese search: real questions against the library (all shards), showing the best blocks, their language and signals.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/check-search-pt.ts
import { getEmbeddingProvider } from "../lib/knowledge/embeddings";
import { NeonLibraryStore } from "../lib/knowledge/library-store";

const QUESTIONS = process.argv.slice(2).length ? process.argv.slice(2) : [
  "O que Josefo diz sobre Jesus?",
  "Plínio escreveu a Trajano sobre os cristãos",
  "o que Tácito conta sobre Nero e a perseguição aos cristãos",
  "Josefo fala de Tiago, o irmão de Jesus",
  "Eusébio e o martírio de Policarpo",
  "a destruição do templo de Jerusalém por Tito",
];
async function main() {
  const emb = getEmbeddingProvider();
  const store = new NeonLibraryStore();
  for (const q of QUESTIONS) {
    const vec = await emb.embedQuery(q);
    const rows = await store.searchChunks({ embedding: vec, text: q, refs: [], perSignal: 12 });
    console.log(`\n? ${q}`);
    for (const r of rows.slice(0, 5)) console.log(`  ${r.language}  ${String(r.id).padEnd(30)} ${(r.signals ?? []).join("+").padEnd(18)} ${String(r.title_path ?? "").slice(0, 95)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
