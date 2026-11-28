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
  const bench = new URL(req.url).searchParams.get("bench") === "1";
  const vec = await getEmbeddingProvider().embedQuery("aquecimento");
  const args = { embedding: vec, text: "aquecimento", refs: [], perSignal: 3 };
  // the first spoken sentence after idle time used to take ~9 s (the voice model loads on first use): load it now too
  const [a, b, c] = await Promise.allSettled([getStore().searchChunks(args), getLibraryStore()?.searchChunks(args) ?? Promise.resolve([]), new PiperTtsProvider().synthesize("Olá.")]);
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
  return Response.json({ ok: true, ms: Date.now() - t0, supabase: a.status, neon: b.status, voice: c.status, shards, ...(timings ? { timings } : {}) });
}
