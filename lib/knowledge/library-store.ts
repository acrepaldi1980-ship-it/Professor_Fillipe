// Library chunks (Neon): same hybrid search as the Supabase store, over public-domain works of the library (D-20).
import type { ChunkRow } from "./db";
import { refQuery, shardUrls } from "./reference-db";

const pgArray = (a: string[]) => `{${a.map((x) => `"${x.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;

export interface LibraryStore {
  searchChunks(a: { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null }): Promise<ChunkRow[]>;
}

type Args = { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null };

/** Rows of several shards fused into one list: highest score first, each chunk once, at most `limit` rows. */
export function mergeShards(parts: ChunkRow[][], limit: number): ChunkRow[] {
  const best = new Map<string, ChunkRow>();
  for (const rows of parts) for (const r of rows) { const prev = best.get(r.id); if (!prev || (r.rrf ?? 0) > (prev.rrf ?? 0)) best.set(r.id, r); }
  return [...best.values()].sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0)).slice(0, limit);
}

/** The library may live in several Neon databases (each free project has 1 GB): the same question goes to all of them at once and the answers are merged. A shard that fails is skipped. */
export class NeonLibraryStore implements LibraryStore {
  constructor(private urls: string[] = shardUrls()) {}
  async searchChunks(a: Args): Promise<ChunkRow[]> {
    const params = [
      `[${a.embedding.map((x) => x.toFixed(6)).join(",")}]`,
      a.text.slice(0, 500),
      pgArray(a.refs.slice(0, 200)),
      Math.min(Math.max(a.perSignal, 1), 60),
      a.workIds ? pgArray(a.workIds) : null,
    ];
    const run = (url: string) => refQuery<ChunkRow>("select * from library_search($1::vector, $2, $3::text[], $4, $5::text[])", params, url);
    if (this.urls.length <= 1) return run(this.urls[0]);
    const parts = await Promise.all(this.urls.map((u) => run(u).catch(() => [] as ChunkRow[])));
    return mergeShards(parts, params[3] as number * 3);
  }
}

export function getLibraryStore(): LibraryStore | undefined {
  return process.env.REFERENCE_DATABASE_URL ? new NeonLibraryStore() : undefined;
}
