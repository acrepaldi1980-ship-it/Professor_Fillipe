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

export interface WebResult { sources: WebSource[]; notes?: string[]; /** What went wrong per provider ("wikipedia:wikipedia_429"), for the turn's metrics and the logs: never the student's text. */ errors: string[] }

/** Runs the providers together within `timeoutMs`, keeps what arrived, at most 4 sources (the first provider's results first). Never throws; says what failed. */
export async function webSearchDetailed(req: WebRequest, opts: { providers?: WebSearchProvider[]; timeoutMs?: number; max?: number; now?: () => number } = {}): Promise<WebResult> {
  if (!webSearchEnabled()) return { sources: [], errors: ["disabled"] };
  const now = opts.now ?? Date.now;
  const hit = cache.get(key(req));
  if (hit && now() - hit.at < TTL_MS) return { sources: hit.value, errors: [] };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 6500);
  const errors: string[] = [];
  const notes: string[] = [];
  try {
    const providers = opts.providers ?? defaultProviders();
    const parts = await Promise.all(providers.map((p) => p.search(req, ctl.signal, notes).catch((e: Error) => { errors.push(`${p.name}:${String(e?.message ?? e).slice(0, 60)}`); return [] as WebSource[]; })));
    const seen = new Set<string>();
    const value = parts.flat().filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, opts.max ?? 4);
    if (value.length) { cache.set(key(req), { at: now(), value }); if (cache.size > 50) cache.delete(cache.keys().next().value as string); }
    if (errors.length) console.error(JSON.stringify({ evt: "websearch_errors", errors }));
    return { sources: value, errors, notes };
  } catch (e) {
    return { sources: [], errors: [`websearch:${String((e as Error)?.message).slice(0, 60)}`] };
  } finally {
    clearTimeout(timer);
  }
}

/** The sources only (for scripts and tests). */
export async function webSearch(req: WebRequest, opts: Parameters<typeof webSearchDetailed>[1] = {}): Promise<WebSource[]> {
  return (await webSearchDetailed(req, opts)).sources;
}

/** Tests only. */
export const resetWebSearchCache = () => cache.clear();
