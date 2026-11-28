// GET /api/v1/warmup -> wakes the parts a first question needs (embedding model, Neon, Supabase search) so the next
// real question is fast. Called every few minutes by .github/workflows/warmup.yml. Reads nothing private, writes nothing.
import { getEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { getStore } from "@/lib/knowledge/db";
import { refQuery, shardUrls } from "@/lib/knowledge/reference-db";
import { getLibraryStore } from "@/lib/knowledge/library-store";
import { PiperTtsProvider } from "@/lib/voice/providers/piper-tts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const t0 = Date.now();
  const bootedAt = (globalThis as { __pfBoot?: number }).__pfBoot ??= Date.now(); // when this server instance first served a warm-up (a fresh instance = a cold start)
  const bench = new URL(req.url).searchParams.get("bench") === "1";
  const vec = await getEmbeddingProvider().embedQuery("aquecimento");
  const embedLoad = (getEmbeddingProvider() as { loadTimings?: Record<string, number> }).loadTimings;
  const args = { embedding: vec, text: "aquecimento", refs: [], perSignal: 3 };
  // the first spoken sentence after idle time used to take ~9 s (the voice model loads on first use): load it now too
  const parts: Record<string, number> = {};
  // ?bench=1 also times the main database call by call (a trivial lookup, then the raw search request twice, then the search through the client): a fresh server instance
  // shows a first search that takes 3 to 5 s on the database side and 0.5 s afterwards (investigation of 28/11/2026, see docs/ARQUITETURA_ANALISE.md)
  if (bench) {
    const t1 = Date.now();
    try { await getStore().titleChunks?.(["aquecimento"]); } catch { /* measured anyway */ }
    parts.supabase_title_lookup_ms = Date.now() - t1;
    const raw: Record<string, number>[] = [];
    for (let i = 0; i < 2; i++) {
      const t3 = Date.now();
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/api_search_chunks`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ q_embedding: `[${args.embedding.map((x) => x.toFixed(6)).join(",")}]`, q_text: args.text, q_refs: [], match_per_signal: 3, allowed_work_ids: null }) });
        const th = Date.now() - t3; const txt = await res.text();
        raw.push({ headers_ms: th, body_ms: Date.now() - t3 - th, bytes: txt.length, status: res.status });
      } catch { raw.push({ headers_ms: -1, body_ms: -1, bytes: 0, status: 0 }); }
    }
    (parts as Record<string, unknown>).raw_search = raw;
  }
  const timed = <T,>(name: string, p: Promise<T>) => p.finally(() => { parts[name] = Date.now() - t0; });
  const [a, b, c] = await Promise.allSettled([timed("supabase", getStore().searchChunks(args)), timed("neon", getLibraryStore()?.searchChunks(args) ?? Promise.resolve([])), timed("voice", new URL(req.url).searchParams.get("novoice") === "1" ? Promise.resolve(null) : new PiperTtsProvider().synthesize("Olá."))]);
  // every library database answers a trivial query (their count and speed, never their addresses)
  const shards = await Promise.all(shardUrls().map(async (u, i) => { const t1 = Date.now(); try { const [r] = await refQuery<{ n: string }>("select count(*)::text n from chunks", [], u); return { shard: i + 1, ok: true, chunks: Number(r.n), ms: Date.now() - t1 }; } catch { return { shard: i + 1, ok: false, chunks: 0, ms: Date.now() - t1 }; } }));
  // ?bench=1: the same hybrid search, three times in a row, on each database, measured inside the server (architecture review: where does the time go?)
  let timings: Record<string, number[]> | undefined;
  if (bench) {
    const time = async (f: () => Promise<unknown>) => { const t1 = Date.now(); try { await f(); } catch { /* counted anyway */ } return Date.now() - t1; };
    const q = { embedding: await getEmbeddingProvider().embedQuery("quem foi Davi, o rei de Israel"), text: "quem foi Davi, o rei de Israel", refs: [] as string[], perSignal: 24 };
    const embedMs = await time(() => getEmbeddingProvider().embedQuery("outra pergunta sobre Moisés e o Egito"));
    const rows: Record<string, number[]> = { supabase_search: [], neon_search: [] };
    for (let i = 0; i < 3; i++) { rows.supabase_search.push(await time(() => getStore().searchChunks(q))); rows.neon_search.push(await time(() => getLibraryStore()!.searchChunks(q))); }
    timings = { embed_warm: [embedMs], ...rows };
  }
  return Response.json({ ok: true, ms: Date.now() - t0, doneAtMs: parts, instanceAgeMs: Date.now() - bootedAt, ...(embedLoad && Object.keys(embedLoad).length ? { embedLoad } : {}), supabase: a.status, neon: b.status, voice: c.status, shards, ...(timings ? { timings } : {}) });
}
