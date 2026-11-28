// Quality check of the move of the search to Neon: the same questions through the Supabase search (api_search_chunks) and through the Neon core search (core_search),
// restricted to the same works. The functions are the same SQL, so the results must be the same; this proves it with real questions.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/compare-core.ts
import { getEmbeddingProvider } from "../lib/knowledge/embeddings";
import { SupabaseRpcStore } from "../lib/knowledge/db";
import { NeonCoreStore, CORE_WORK_IDS, coreUrl } from "../lib/knowledge/core-store";
import { findReferences } from "../lib/knowledge/refs-parser";

const QUESTIONS = [
  "Quem foi Davi?", "Me fale tudo sobre Zaqueu", "Quem foi Barnabé?", "O que a Bíblia diz sobre Nicodemos", "Quem foi Moisés?", "Fale sobre Lázaro", "Quem foi Jonas?", "A vida de Paulo",
  "O que é a graça?", "O que é justificação pela fé?", "O que é o batismo?", "Como orar?", "O que significa arrepender-se?", "O que é o Reino de Deus?", "Qual o sentido da cruz?",
  "Explique a parábola do filho pródigo", "João 3:16", "Romanos 8:28", "Salmo 23", "Gênesis 1:1-3", "Atos 8:26-40", "Mateus 5:3-12", "Apocalipse 21:1-4", "Isaías 53",
  "Altura do Monte Carmelo", "Onde fica Belém?", "A arca da aliança", "O tabernáculo no deserto", "A queda de Jericó", "Quem foi Pôncio Pilatos?",
  "Who was David?", "What is grace?", "Tell me about Zacchaeus", "The Sermon on the Mount", "Love your enemies", "the fruit of the Spirit",
  "escatologia e a segunda vinda de Cristo", "o milênio de Apocalipse 20", "a ressurreição dos mortos", "o Espírito Santo e os dons", "a Trindade", "o pecado original",
  "perdão e reconciliação", "o sábado e o dia do Senhor", "o dízimo", "casamento e divórcio", "a oração do Pai Nosso", "os dez mandamentos", "a criação e o dilúvio", "Elias no Monte Carmelo",
  "Estevão e o primeiro mártir", "a conversão de Saulo", "o bom samaritano", "a ceia do Senhor", "profecias sobre o Messias", "Sansão e Dalila", "Ester e o rei Assuero", "Rute e Boaz", "a torre de Babel", "o êxodo do Egito",
];
const ids = [...CORE_WORK_IDS];
async function main() {
  const emb = getEmbeddingProvider();
  const sb = new SupabaseRpcStore();
  const url = coreUrl();
  if (!url) throw new Error("no Neon URL (REFERENCE_DATABASE_URL_2)");
  const core = new NeonCoreStore(url);
  let same = 0, top5 = 0, missing = 0, n = 0, tSb = 0, tCore = 0;
  const diffs: string[] = [];
  for (const q of QUESTIONS) {
    const vec = await emb.embedQuery(q);
    const refs = findReferences(q).flatMap((r) => r.refs);
    const a = { embedding: vec, text: q, refs, perSignal: 24, workIds: ids };
    let t = Date.now(); const A = await sb.searchChunks(a).catch(() => []); tSb += Date.now() - t;
    t = Date.now(); const B = await core.searchChunks(a).catch(() => []); tCore += Date.now() - t;
    n++;
    const sa = new Set(A.map((r) => r.id)), sbb = new Set(B.map((r) => r.id));
    const inter = [...sa].filter((x) => sbb.has(x)).length;
    const jacc = inter / Math.max(1, new Set([...sa, ...sbb]).size);
    if (jacc >= 0.98) same++;
    const topA = A.slice(0, 5).map((r) => r.id), topB = new Set(B.slice(0, 5).map((r) => r.id));
    if (topA.filter((x) => topB.has(x)).length >= 4) top5++;
    if (!B.length) missing++;
    if (jacc < 0.9) diffs.push(`${q}: overlap ${(jacc * 100).toFixed(0)}% (supabase ${A.length} rows, neon ${B.length} rows)`);
  }
  console.log(JSON.stringify({ questions: n, identicalSets: same, top5Agree: top5, neonEmpty: missing, avgMs: { supabase: Math.round(tSb / n), neon: Math.round(tCore / n) } }));
  for (const d of diffs.slice(0, 12)) console.log("  differs:", d);
}
main().catch((e) => { console.error(e); process.exit(1); });
