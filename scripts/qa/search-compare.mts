// Compares the old search RPC with the fast one on real questions: same results? how long?
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
const emb = getEmbeddingProvider();
const qs: [string, string[]][] = [
  ["Quem foi Filipe em Atos 8?", ["ACT.8.26-ACT.8.40"]], ["O que significa graça?", []], ["Explique João 3:16", ["JHN.3.16"]],
  ["Qual a diferença entre o batismo de João e o de Jesus?", []], ["O que é a Trindade?", []], ["Quem foi Barnabé?", []], ["propiciatório arca da aliança", ["EXO.25.17"]], ["salvação pela fé", ["EPH.2.8"]],
];
let over = 0, tot = 0, tOld = 0, tNew = 0;
for (const [q, refs] of qs) {
  const v = `[${(await emb.embedQuery(q)).map((x) => x.toFixed(6)).join(",")}]`;
  const args = { q_embedding: v, q_text: q, q_refs: refs, match_per_signal: 24, allowed_work_ids: null };
  let t = Date.now(); const a = await sb.rpc("api_search_chunks", args); const dOld = Date.now() - t;
  t = Date.now(); const b = await sb.rpc("api_search_chunks_fast", args); const dNew = Date.now() - t;
  if (a.error || b.error) { console.log("ERR", a.error?.message, b.error?.message); continue; }
  const A = new Set((a.data as { id: string }[]).slice(0, 12).map((r) => r.id)), B = (b.data as { id: string }[]).slice(0, 12).map((r) => r.id);
  const inter = B.filter((x) => A.has(x)).length; over += inter; tot += Math.max(1, Math.min(12, A.size)); tOld += dOld; tNew += dNew;
  console.log(`${q.slice(0, 38).padEnd(40)} old ${String(dOld).padStart(5)}ms (${a.data!.length} rows)  new ${String(dNew).padStart(5)}ms (${b.data!.length} rows)  top12 overlap ${inter}/${Math.min(12, A.size)}`);
}
console.log(`overall top-12 overlap ${(100 * over / tot).toFixed(0)}%  old ${tOld}ms  new ${tNew}ms`);
