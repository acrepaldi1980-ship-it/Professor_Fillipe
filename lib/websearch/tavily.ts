// Tavily (a search API made for AI assistants): the general-web provider, used only when TAVILY_API_KEY is set (free plan: no card). Results are filtered
// like any other outside source: the teacher reads only the returned passages and says where they came from.
import { z } from "zod";
import type { WebRequest, WebSearchProvider, WebSource } from "./types";

const Response = z.object({ results: z.array(z.object({ title: z.string(), url: z.string().url(), content: z.string() })).default([]) });

export class TavilyProvider implements WebSearchProvider {
  readonly name = "tavily";
  constructor(private apiKey: string, private fetcher: typeof fetch = fetch, private timeoutMs = 5000) {}

  async search(req: WebRequest, signal?: AbortSignal): Promise<WebSource[]> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const res = await this.fetcher("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query: `${req.question} (contexto bíblico, Bíblia)`, search_depth: "basic", max_results: 4, include_answer: false }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) throw new Error(`tavily_${res.status}`);
    const parsed = Response.safeParse(await res.json());
    if (!parsed.success) return [];
    return parsed.data.results.slice(0, 4).map((r) => {
      const host = new URL(r.url).hostname.replace(/^www\./, "");
      return { provider: "tavily" as const, title: r.title.slice(0, 160), url: r.url, site: host, lang: "pt", license: "ver o site de origem", passages: [r.content.slice(0, 900)], retrievedAt: new Date().toISOString() };
    });
  }
}
