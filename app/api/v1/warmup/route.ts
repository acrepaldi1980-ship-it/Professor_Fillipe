// GET /api/v1/warmup -> wakes the parts a first question needs (embedding model, Neon, Supabase search) so the next
// real question is fast. Called every few minutes by .github/workflows/warmup.yml. Reads nothing private, writes nothing.
import { getEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { getStore } from "@/lib/knowledge/db";
import { getLibraryStore } from "@/lib/knowledge/library-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const t0 = Date.now();
  const vec = await getEmbeddingProvider().embedQuery("aquecimento");
  const args = { embedding: vec, text: "aquecimento", refs: [], perSignal: 3 };
  const [a, b] = await Promise.allSettled([getStore().searchChunks(args), getLibraryStore()?.searchChunks(args) ?? Promise.resolve([])]);
  return Response.json({ ok: true, ms: Date.now() - t0, supabase: a.status, neon: b.status });
}
