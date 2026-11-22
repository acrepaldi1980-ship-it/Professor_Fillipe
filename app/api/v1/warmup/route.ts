// GET /api/v1/warmup -> wakes the parts a first question needs (embedding model, Neon, Supabase search) so the next
// real question is fast. Called every few minutes by .github/workflows/warmup.yml. Reads nothing private, writes nothing.
import { getEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { getStore } from "@/lib/knowledge/db";
import { refQuery, shardUrls } from "@/lib/knowledge/reference-db";
import { getLibraryStore } from "@/lib/knowledge/library-store";
import { PiperTtsProvider } from "@/lib/voice/providers/piper-tts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const t0 = Date.now();
  const vec = await getEmbeddingProvider().embedQuery("aquecimento");
  const args = { embedding: vec, text: "aquecimento", refs: [], perSignal: 3 };
  // the first spoken sentence after idle time used to take ~9 s (the voice model loads on first use): load it now too
  const [a, b, c] = await Promise.allSettled([getStore().searchChunks(args), getLibraryStore()?.searchChunks(args) ?? Promise.resolve([]), new PiperTtsProvider().synthesize("Olá.")]);
  // every library database answers a trivial query (their count and speed, never their addresses)
  const shards = await Promise.all(shardUrls().map(async (u, i) => { const t1 = Date.now(); try { const [r] = await refQuery<{ n: string }>("select count(*)::text n from chunks", [], u); return { shard: i + 1, ok: true, chunks: Number(r.n), ms: Date.now() - t1 }; } catch { return { shard: i + 1, ok: false, chunks: 0, ms: Date.now() - t1 }; } }));
  return Response.json({ ok: true, ms: Date.now() - t0, supabase: a.status, neon: b.status, voice: c.status, shards });
}
