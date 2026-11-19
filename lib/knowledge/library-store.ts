// Library chunks (Neon): same hybrid search as the Supabase store, over public-domain works of the library (D-20).
import type { ChunkRow } from "./db";
import { refQuery } from "./reference-db";

const pgArray = (a: string[]) => `{${a.map((x) => `"${x.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;

export interface LibraryStore {
  searchChunks(a: { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null }): Promise<ChunkRow[]>;
}

export class NeonLibraryStore implements LibraryStore {
  async searchChunks(a: { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null }): Promise<ChunkRow[]> {
    return refQuery<ChunkRow>("select * from library_search($1::vector, $2, $3::text[], $4, $5::text[])", [
      `[${a.embedding.map((x) => x.toFixed(6)).join(",")}]`,
      a.text.slice(0, 500),
      pgArray(a.refs.slice(0, 200)),
      Math.min(Math.max(a.perSignal, 1), 60),
      a.workIds ? pgArray(a.workIds) : null,
    ]);
  }
}

export function getLibraryStore(): LibraryStore | undefined {
  return process.env.REFERENCE_DATABASE_URL ? new NeonLibraryStore() : undefined;
}
