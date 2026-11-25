// Library chunks (Neon): same hybrid search as the Supabase store, over public-domain works of the library (D-20).
import type { ChunkRow } from "./db";
import { refQuery, shardUrls } from "./reference-db";

const pgArray = (a: string[]) => `{${a.map((x) => `"${x.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;

export interface LibraryStore {
  searchChunks(a: { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null }): Promise<ChunkRow[]>;
  /** Dictionary entries titled exactly with one of the words ("zacchaeus"). Shards without the title index are skipped. */
  titleChunks?(titles: string[], phrase?: string): Promise<ChunkRow[]>;
}

type Args = { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null };

/** Rows of several shards fused into one list: highest score first, each chunk once, at most `limit` rows. */
export function mergeShards(parts: ChunkRow[][], limit: number): ChunkRow[] {
  const best = new Map<string, ChunkRow>();
  for (const rows of parts) for (const r of rows) { const prev = best.get(r.id); if (!prev || (r.rrf ?? 0) > (prev.rrf ?? 0)) best.set(r.id, r); }
  return [...best.values()].sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0)).slice(0, limit);
}

/**
 * Josephus exists in the index twice, in English and in Portuguese, with the same blocks (ids differ only by ":pt"). When both come back, only the Portuguese one is
 * kept: the same passage twice would waste the teacher's context. The Portuguese block says in its title that it is a machine translation.
 */
export function dropEnglishTwins(rows: ChunkRow[]): ChunkRow[] {
  const have = new Set(rows.map((r) => r.id));
  return rows.filter((r) => {
    const i = r.id.indexOf(":");
    return r.language === "pt" || i < 0 || !have.has(`${r.id.slice(0, i)}:pt:${r.id.slice(i + 1)}`);
  });
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
    if (this.urls.length <= 1) return dropEnglishTwins(await run(this.urls[0]));
    const parts = await Promise.all(this.urls.map((u) => run(u).catch(() => [] as ChunkRow[])));
    return dropEnglishTwins(mergeShards(parts, params[3] as number * 3));
  }
  /** Entry lookup by title in every shard that has the index (library_titles); the others answer nothing. */
  async titleChunks(titles: string[], phrase?: string): Promise<ChunkRow[]> {
    const usePhrase = !!phrase && phrase.trim().split(/\s+/).length >= 2 && phrase.length <= 120;
    const parts = await Promise.all(this.urls.flatMap((u) => [
      refQuery<ChunkRow>("select * from library_titles($1::text[], 24)", [pgArray(titles.slice(0, 40))], u).catch(() => [] as ChunkRow[]),
      ...(usePhrase ? [refQuery<ChunkRow>("select * from library_phrase_titles($1, 6)", [phrase], u).catch(() => [] as ChunkRow[])] : []),
    ]));
    return parts.flat();
  }
}

export function getLibraryStore(): LibraryStore | undefined {
  return process.env.REFERENCE_DATABASE_URL ? new NeonLibraryStore() : undefined;
}
