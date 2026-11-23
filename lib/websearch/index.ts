// Entry point of the outside research: providers in order, a time budget (a spoken conversation cannot wait long), a short cache, and an off switch (WEB_SEARCH=off).
import { TavilyProvider } from "./tavily";
import { WikipediaProvider } from "./wikipedia";
import type { WebRequest, WebSearchProvider, WebSource } from "./types";

export type { WebRequest, WebSearchProvider, WebSource } from "./types";

export const webSearchEnabled = (env: NodeJS.ProcessEnv = process.env) => env.WEB_SEARCH !== "off";

export function defaultProviders(env: NodeJS.ProcessEnv = process.env): WebSearchProvider[] {
  return [...(env.TAVILY_API_KEY ? [new TavilyProvider(env.TAVILY_API_KEY)] : []), new WikipediaProvider()];
}

const cache = new Map<string, { at: number; value: WebSource[] }>();
const TTL_MS = 15 * 60 * 1000;
const key = (r: WebRequest) => `${r.question.toLowerCase().trim()}|${r.english ?? ""}`;

/** Runs the providers together within `timeoutMs`, keeps what arrived, at most 4 sources (the first provider's results first). Never throws. */
export async function webSearch(req: WebRequest, opts: { providers?: WebSearchProvider[]; timeoutMs?: number; max?: number; now?: () => number } = {}): Promise<WebSource[]> {
  if (!webSearchEnabled()) return [];
  const now = opts.now ?? Date.now;
  const hit = cache.get(key(req));
  if (hit && now() - hit.at < TTL_MS) return hit.value;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 6500);
  try {
    const parts = await Promise.all((opts.providers ?? defaultProviders()).map((p) => p.search(req, ctl.signal).catch(() => [] as WebSource[])));
    const seen = new Set<string>();
    const value = parts.flat().filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, opts.max ?? 4);
    if (value.length) { cache.set(key(req), { at: now(), value }); if (cache.size > 50) cache.delete(cache.keys().next().value as string); }
    return value;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Tests only. */
export const resetWebSearchCache = () => cache.clear();
