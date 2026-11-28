// The "core" search on Neon (28/11/2026): Bible windows (Portuguese, English) and Easton's dictionary. Moved from the Supabase search because the free Supabase plan
// answered its first search after a pause in 3 to 6 s about 40% of the time (Neon: 0.53 s every time; docs/ARQUITETURA_ANALISE.md 7.3). The own notes that the
// administration publishes (dynamic, few) and everything else personal stay on Supabase.
import { refQuery } from "./reference-db";
import { SupabaseRpcStore, type ChunkRow, type KnowledgeStore, type VerseRow } from "./db";

const pgArray = (a: string[]) => `{${a.map((x) => `"${x.replace(/(["\\])/g, "\\$&")}"`).join(",")}}`;
/** Works whose chunks are in the core tables (the others, e.g. the published own notes, are searched on Supabase). */
export const CORE_WORK_IDS = new Set(["bible_por_blivre_2018", "bible_eng_web", "easton_1897"]);
/** Dynamic works kept on Supabase: asked for in the background, their absence never delays or fails a search. */
const SUPABASE_ONLY_WORKS = ["own_notes_pentecostal"];
const NOTES_BUDGET_MS = 1200;

type Args = { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null };

export function coreUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.CORE_DATABASE_URL ?? env.REFERENCE_DATABASE_URL_2;
}

/** Rows of several searches fused into one list: the best score for each chunk, highest first. */
export function mergeRows(parts: ChunkRow[][], limit: number): ChunkRow[] {
  const best = new Map<string, ChunkRow>();
  for (const rows of parts) for (const r of rows) { const prev = best.get(r.id); if (!prev || (r.rrf ?? 0) > (prev.rrf ?? 0)) best.set(r.id, r); }
  return [...best.values()].sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0)).slice(0, limit);
}

const within = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

export class NeonCoreStore {
  constructor(private url: string) {}
  searchChunks(a: Args): Promise<ChunkRow[]> {
    const params = [`[${a.embedding.map((x) => x.toFixed(6)).join(",")}]`, a.text.slice(0, 500), pgArray(a.refs.slice(0, 200)), Math.min(Math.max(a.perSignal, 1), 60), a.workIds ? pgArray(a.workIds) : null];
    return refQuery<ChunkRow>("select * from core_search($1::vector, $2, $3::text[], $4, $5::text[])", params, this.url);
  }
  titleChunks(titles: string[]): Promise<ChunkRow[]> {
    return refQuery<ChunkRow>("select * from core_titles($1::text[], 24)", [pgArray(titles.slice(0, 40))], this.url);
  }
}

/**
 * The store of the app: core search and entry titles on Neon, everything else (verses, lenses, published notes) on Supabase. If Neon fails, the Supabase search answers
 * instead (slower on a bad day, but never empty). The Neon path is on only with `CORE_SEARCH=neon`.
 */
export class HybridStore implements KnowledgeStore {
  constructor(private sb: KnowledgeStore, private core: NeonCoreStore | null) {}

  async searchChunks(a: Args): Promise<ChunkRow[]> {
    if (!this.core) return this.sb.searchChunks(a);
    const ids = a.workIds ?? null;
    const coreIds = ids ? ids.filter((i) => CORE_WORK_IDS.has(i)) : null;
    const sbIds = ids ? ids.filter((i) => !CORE_WORK_IDS.has(i)) : SUPABASE_ONLY_WORKS;
    const core = ids && !coreIds!.length ? Promise.resolve([] as ChunkRow[]) : this.core.searchChunks({ ...a, workIds: coreIds });
    // the notes (or the non-core works asked for) are best-effort when they come with the core search, and the only source when nothing else was asked
    const others = sbIds.length ? this.sb.searchChunks({ ...a, workIds: sbIds, perSignal: Math.min(a.perSignal, 12) }) : Promise.resolve([] as ChunkRow[]);
    try {
      const [c, o] = await Promise.all([core, ids && !coreIds!.length ? others : within(others, NOTES_BUDGET_MS, [] as ChunkRow[])]);
      // an empty core answer to an unrestricted search means the core tables are not there (or are empty): the old path answers
      if (!c.length && !ids) return this.sb.searchChunks(a);
      return o.length ? mergeRows([c, o], a.perSignal * 2) : c;
    } catch (e) {
      console.error(JSON.stringify({ evt: "core_search_failed", reason: String((e as Error).message).slice(0, 80) }));
      return this.sb.searchChunks(a); // the old path: Supabase answers the whole search
    }
  }

  async titleChunks(titles: string[]): Promise<ChunkRow[]> {
    if (!this.core) return this.sb.titleChunks?.(titles) ?? [];
    try { return await this.core.titleChunks(titles); } catch { return this.sb.titleChunks?.(titles) ?? []; }
  }
  bibleVerses(version: string, refs: string[], chapters: string[]): Promise<VerseRow[]> { return this.sb.bibleVerses(version, refs, chapters); }
  lensWorks(traditions: string[]): Promise<string[]> { return this.sb.lensWorks?.(traditions) ?? Promise.resolve([]); }
}

export function createStore(): KnowledgeStore {
  const sb = new SupabaseRpcStore();
  const url = coreUrl();
  // opt-in until the core tables are verified in production: CORE_SEARCH=neon turns the Neon path on
  return new HybridStore(sb, url && process.env.CORE_SEARCH === "neon" ? new NeonCoreStore(url) : null);
}
