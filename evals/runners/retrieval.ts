// Retrieval evaluation (spec 16.1): 50 questions in Portuguese with the expected passage; passes when the expected passage is
// among the top 5 chunks (Easton entry by title, or a Bible window that covers the expected chapter). Goal: >= 85%.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local evals/runners/retrieval.ts [--no-rewrite]
import { readFileSync, writeFileSync } from "node:fs";
import { searchChunks } from "../../lib/knowledge/search";
import { rewriteQueryToEnglish } from "../../lib/teacher/groq";

interface Item { id: string; question: string; expect: { easton_title?: string; refs?: string[] } }

async function main() {
  const items = JSON.parse(readFileSync("evals/datasets/retrieval.json", "utf8")) as Item[];
  const rewrite = !process.argv.includes("--no-rewrite");
  let pass = 0;
  const lines: string[] = [];
  for (const it of items) {
    const rewritten = rewrite ? await rewriteQueryToEnglish(it.question).catch(() => null) : null;
    const { chunks } = await searchChunks(rewritten ? [it.question, rewritten] : it.question, { maxChunks: 12, maxTokens: 20000 });
    const top = chunks.slice(0, 5);
    const ok = top.some((c) => {
      const byTitle = !!it.expect.easton_title && c.work_id === "easton_1897" && new RegExp(it.expect.easton_title, "i").test(c.title_path ?? "");
      const byRef = !!it.expect.refs && (c.refs ?? []).some((r) => it.expect.refs!.some((p) => r.startsWith(p + ".") || r === p));
      return byTitle || byRef;
    });
    if (ok) pass++;
    lines.push(`${ok ? "PASS" : "FAIL"} ${it.id} ${it.question}${ok ? "" : `  -> top: ${top.map((c) => `${c.work_id}:${(c.title_path ?? "").slice(0, 25)}`).join(" | ")}`}`);
    console.log(lines.at(-1));
  }
  const pct = Math.round((pass / items.length) * 100);
  const report = `# Avaliação de busca (${new Date().toISOString().slice(0, 10)})\n\nAcertos no top 5: ${pass}/${items.length} (${pct}%). Meta: 85%.\nReescrita em inglês: ${rewrite ? "ligada" : "desligada"}.\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
  writeFileSync(`evals/reports/${new Date().toISOString().slice(0, 10)}-retrieval.md`, report);
  console.log(`\n${pass}/${items.length} = ${pct}%`);
}
main();
