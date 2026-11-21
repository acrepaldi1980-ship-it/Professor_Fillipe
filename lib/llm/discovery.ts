// Free model names change all the time (OpenRouter's ":free" list especially). Instead of hard-coding them, the server asks the provider
// which models are free right now (every few hours) and the pool is rebuilt from that list. Best effort: any failure keeps the defaults.
import type { ModelDef } from "./registry";
import { setDiscovered } from "./registry";

interface OrModel { id: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[]; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }

const TTL = 6 * 3600_000;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;

export function pickOpenRouterFree(models: OrModel[]): ModelDef[] {
  const free = models.filter((m) => String(m.pricing?.prompt) === "0" && String(m.pricing?.completion) === "0" && !/embed|guard|moderation|vision|-vl|image|audio|tts|whisper/i.test(m.id) && (m.architecture?.output_modalities ?? ["text"]).every((x) => x === "text"));
  const usable = free.filter((m) => (m.supported_parameters ?? []).some((p) => p === "tools" || p === "response_format" || p === "structured_outputs") && (m.context_length ?? 0) >= 8000);
  usable.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));
  return usable.slice(0, 6).map((m, i) => ({ name: m.id, tier: i < 3 ? 1 : 2, tools: (m.supported_parameters ?? []).includes("tools") }));
}

export async function ensureDiscovery(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<void> {
  if (!env.OPENROUTER_API_KEY && !env.OPENROUTER_API_KEYS) return;
  if (env.OPENROUTER_MODELS) return; // the owner chose the models
  if (Date.now() - fetchedAt < TTL) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const key = (env.OPENROUTER_API_KEY ?? env.OPENROUTER_API_KEYS ?? "").split(",")[0].trim();
      const res = await fetcher("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(3500), headers: key ? { Authorization: `Bearer ${key}` } : {} });
      if (!res.ok) return;
      const list = pickOpenRouterFree(((await res.json()) as { data?: OrModel[] }).data ?? []);
      if (list.length) { setDiscovered("openrouter", list); fetchedAt = Date.now(); }
    } catch { /* keep the defaults */ } finally { inflight = null; }
  })();
  return inflight;
}
