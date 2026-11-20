// Illustration service (RF-M08-04): RA-20 filter -> fixed style -> cache by prompt hash -> approved library -> generation with a daily limit.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imageProvider, type ImageProvider } from "./image-provider";
import { applyRa20 } from "./ra20";
import { STYLE_PREFIX, STYLE_SUFFIX, STYLE_VERSION } from "./style";

export type IllustrationOutcome =
  | { status: "ok"; hash: string; alt: string; cached: boolean }
  | { status: "refused" | "limit" | "unavailable" };

export const normalizePrompt = (p: string) => p.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
export const promptHash = (safePrompt: string) => createHash("sha256").update(`v${STYLE_VERSION}|${normalizePrompt(safePrompt)}`).digest("hex").slice(0, 32);

/** Keywords used to look the prompt up in the approved library (tags). */
export function tagsOf(prompt: string): string[] {
  return normalizePrompt(prompt).split(" ").filter((w) => w.length >= 5).slice(0, 8);
}

export async function getOrCreateIllustration(db: SupabaseClient, input: { prompt: string; alt?: string }, opts: { dailyLimit?: number; provider?: ImageProvider } = {}): Promise<IllustrationOutcome> {
  const safe = applyRa20(input.prompt);
  if (!safe.ok) return { status: "refused" };
  const alt = (input.alt ?? `Ilustração: ${safe.prompt}`).slice(0, 300);
  const hash = promptHash(safe.prompt);

  const cached = await db.rpc("api_illustration_get", { p_hash: hash });
  if (cached.data?.length) return { status: "ok", hash, alt: cached.data[0].alt ?? alt, cached: true };

  // Approved library: reuse before paying for a new image.
  const lib = await db.rpc("api_illustration_library", { p_tags: tagsOf(safe.prompt) });
  if (lib.data?.length) return { status: "ok", hash: lib.data[0].prompt_hash, alt: lib.data[0].alt ?? alt, cached: true };

  const limit = opts.dailyLimit ?? (Number(process.env.ILLUSTRATIONS_DAILY_LIMIT) || 3);
  const quota = await db.rpc("api_illustration_quota", { p_limit: limit });
  if (!quota.data) return { status: "limit" };
  try {
    const img = await (opts.provider ?? imageProvider()).generate(`${STYLE_PREFIX}${safe.prompt}.${STYLE_SUFFIX}`);
    const { error } = await db.rpc("api_illustration_put", { p_hash: hash, p_prompt: safe.prompt, p_image: img.b64, p_mime: img.mime, p_alt: alt, p_style: STYLE_VERSION });
    if (error) return { status: "unavailable" };
    return { status: "ok", hash, alt, cached: false };
  } catch {
    return { status: "unavailable" };
  }
}
