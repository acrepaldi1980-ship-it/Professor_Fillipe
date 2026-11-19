// Prompt layers from `prompt_versions` (spec 11, Prompt 1.5): the active version of each editable layer, cached for a minute.
// Version 1 of every text lives in lib/teacher/prompts.ts (the fallback when the table is empty or unreachable).
import { createClient } from "@supabase/supabase-js";

export interface PromptLayers {
  identity?: string;
  mode_free?: string;
  /** Highest version among the layers in use (for logs and reports). */
  version: number;
}

let cache: { at: number; value: PromptLayers | null } | null = null;
const TTL_MS = 60_000;

export async function loadActiveLayers(): Promise<PromptLayers | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: PromptLayers | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await db.rpc("api_active_prompts");
      const rows = (data ?? []) as { layer: string; content: string; version: number }[];
      if (rows.length) {
        value = { version: Math.max(...rows.map((r) => r.version)) };
        for (const r of rows) if (r.layer === "identity" || r.layer === "mode_free") value[r.layer] = r.content;
      }
    }
  } catch {
    value = null;
  }
  cache = { at: Date.now(), value };
  return value;
}
