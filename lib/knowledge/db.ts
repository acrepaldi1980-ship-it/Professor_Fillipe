// Knowledge-base access for the app (server only). It uses the PUBLISHABLE Supabase key and calls restricted
// database functions (migration 0007); the deployed app never holds an account-level token.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ChunkRow {
  id: string;
  work_id: string;
  text: string;
  title_path: string | null;
  refs: string[];
  tradition: string;
  kind: string;
  language: string;
  tokens: number | null;
  rrf: number;
  signals: string[];
}

export interface VerseRow {
  version_id: string;
  ref: string;
  text: string;
}

export interface KnowledgeStore {
  searchChunks(a: { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null }): Promise<ChunkRow[]>;
  bibleVerses(version: string, refs: string[], chapters: string[]): Promise<VerseRow[]>;
  /** Dictionary/encyclopedia entries whose title equals one of the given words (optional: test doubles may omit it). */
  titleChunks?(titles: string[]): Promise<ChunkRow[]>;
  /** Ids of the enabled works of the given traditions (the student's lenses). */
  lensWorks?(traditions: string[]): Promise<string[]>;
}

export class SupabaseRpcStore implements KnowledgeStore {
  private client: SupabaseClient;
  constructor(client?: SupabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!client && (!url || !key)) throw new Error("supabase_not_configured");
    this.client = client ?? createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async searchChunks(a: { embedding: number[]; text: string; refs: string[]; perSignal: number; workIds?: string[] | null }): Promise<ChunkRow[]> {
    const { data, error } = await this.client.rpc("api_search_chunks", {
      q_embedding: `[${a.embedding.map((x) => x.toFixed(6)).join(",")}]`,
      q_text: a.text,
      q_refs: a.refs,
      match_per_signal: a.perSignal,
      allowed_work_ids: a.workIds ?? null,
    });
    if (error) throw new Error(`search_failed: ${error.message.slice(0, 120)}`);
    return (data ?? []) as ChunkRow[];
  }

  async titleChunks(titles: string[]): Promise<ChunkRow[]> {
    const { data, error } = await this.client.rpc("api_title_chunks", { p_titles: titles.slice(0, 40), p_limit: 24 });
    if (error) throw new Error(`title_failed: ${error.message.slice(0, 120)}`);
    return (data ?? []) as ChunkRow[];
  }

  async lensWorks(traditions: string[]): Promise<string[]> {
    const { data, error } = await this.client.rpc("api_lens_works", { p_traditions: traditions });
    if (error) throw new Error(`lens_failed: ${error.message.slice(0, 120)}`);
    return ((data ?? []) as { id: string }[]).map((r) => r.id);
  }

  async bibleVerses(version: string, refs: string[], chapters: string[]): Promise<VerseRow[]> {
    const { data, error } = await this.client.rpc("api_bible_verses", { p_version: version, p_refs: refs, p_chapters: chapters });
    if (error) throw new Error(`verses_failed: ${error.message.slice(0, 120)}`);
    return (data ?? []) as VerseRow[];
  }
}

let store: KnowledgeStore | null = null;
export function getStore(): KnowledgeStore {
  store ??= new SupabaseRpcStore();
  return store;
}
