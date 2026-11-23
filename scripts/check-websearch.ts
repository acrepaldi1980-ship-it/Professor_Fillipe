// Runs the outside research on real questions (live Wikipedia) and prints what the teacher would be given.
// Usage: NODE_OPTIONS=--use-env-proxy tsx scripts/check-websearch.ts "pergunta" ["english keywords"]
import { webSearch } from "../lib/websearch";

async function main() {
  const question = process.argv[2] ?? "Qual é a altura do Monte Carmelo?";
  const english = process.argv[3] ?? null;
  const t0 = Date.now();
  const sources = await webSearch({ question, english });
  console.log(`? ${question}  (${Date.now() - t0} ms, ${sources.length} fontes)`);
  for (const s of sources) {
    console.log(`\n  [${s.site}] ${s.title}\n  ${s.url}  (${s.license})`);
    for (const p of s.passages) console.log(`    - ${p.slice(0, 230)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
