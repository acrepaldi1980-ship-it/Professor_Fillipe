// Wikipedia (Portuguese and English) as the free, key-less outside source: text under CC BY-SA 4.0, credit and link shown with every answer that uses it.
// Method of a careful researcher: find the article of the SUBJECT (not of the whole sentence, which brings football clubs), read the whole article, keep the
// passages that answer what was asked. Pages that are not about the biblical world are discarded.
import { attributeTerms, entityPhrase, htmlToText, isBiblicalPage, pickPassages } from "./text";
import type { WebRequest, WebSearchProvider, WebSource } from "./types";

const UA = "ProfessorFilipeApp/1.0 (https://professor-filipe.vercel.app; Bible study app; contact via the site)";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const api = (lang: string) => `https://${lang}.wikipedia.org/w/api.php`;

export class WikipediaProvider implements WebSearchProvider {
  readonly name = "wikipedia";
  constructor(private fetcher: typeof fetch = fetch, private langs: string[] = ["pt", "en"], private perRequestMs = 4500) {}

  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const timeout = AbortSignal.timeout(this.perRequestMs);
    const go = () => this.fetcher(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA }, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    let res = await go();
    // The API answers 429 when too many requests come from one address: wait what it asks (at most 1.5 s) and try once more.
    if (res.status === 429) { await new Promise((r) => setTimeout(r, Math.min(1500, (Number(res.headers.get("retry-after")) || 1) * 1000))); res = await go(); }
    if (!res.ok) throw new Error(`wikipedia_${res.status}`);
    return (await res.json()) as T;
  }

  /** Pages that look like the subject. An exact title wins alone; without one, up to two titles that contain all its words. */
  private async candidates(lang: string, entity: string, signal?: AbortSignal): Promise<{ title: string; exact: boolean }[]> {
    const q = new URLSearchParams({ action: "query", list: "search", srsearch: entity, srlimit: "6", format: "json", formatversion: "2" });
    const data = await this.json<{ query?: { search?: { title: string }[] } }>(`${api(lang)}?${q}`, signal);
    const words = norm(entity).split(/\s+/).filter(Boolean);
    const ranked = (data.query?.search ?? []).map((r, i) => {
      const t = norm(r.title.replace(/\s*\(.*\)\s*$/, ""));
      const score = t === norm(entity) ? 3 : words.length && words.every((w) => t.includes(w)) ? 2 : 0;
      return { title: r.title, score, i, plain: !/\(/.test(r.title) };
    }).filter((x) => x.score > 0);
    const sorted = ranked.sort((a, b) => b.score - a.score || Number(b.plain) - Number(a.plain) || a.i - b.i);
    if (sorted[0]?.score === 3) return [{ title: sorted[0].title, exact: true }];
    return sorted.slice(0, 2).map((x) => ({ title: x.title, exact: false }));
  }

  private async page(lang: string, title: string, signal?: AbortSignal): Promise<{ title: string; url: string; text: string } | null> {
    const q = new URLSearchParams({ action: "parse", page: title, prop: "text", redirects: "1", disableeditsection: "1", disabletoc: "1", format: "json", formatversion: "2" });
    const data = await this.json<{ parse?: { title: string; text: string } }>(`${api(lang)}?${q}`, signal);
    if (!data.parse?.text) return null;
    return { title: data.parse.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.parse.title.replace(/ /g, "_"))}`, text: htmlToText(data.parse.text) };
  }

  private async forLanguage(lang: string, req: WebRequest, signal?: AbortSignal): Promise<WebSource[]> {
    // English keywords come "subject first": their first item is the subject for the English pages.
    const entity = lang === "en" && req.english ? req.english.split(",")[0].replace(/\b(height|elevation|size|length|width|depth|population|meaning)\b/gi, "").trim() : entityPhrase(req.question);
    if (!entity) return [];
    const { terms } = attributeTerms(req.question);
    const out: WebSource[] = [];
    for (const { title, exact } of await this.candidates(lang, entity, signal)) {
      const p = await this.page(lang, title, signal);
      if (!p || !isBiblicalPage(p.text, exact ? 2 : 3)) continue; // a page whose title is exactly the subject needs less proof of being biblical
      const passages = pickPassages(p.text, `${req.question} ${entity}`, { terms });
      if (passages.length) out.push({ provider: "wikipedia", title: p.title, url: p.url, site: `${lang === "pt" ? "Wikipédia" : "Wikipedia"} (${lang})`, lang, license: "CC BY-SA 4.0", passages, retrievedAt: new Date().toISOString() });
    }
    return out;
  }

  async search(req: WebRequest, signal?: AbortSignal): Promise<WebSource[]> {
    const parts = await Promise.allSettled(this.langs.map((l) => this.forLanguage(l, req, signal)));
    // one language failing is fine; every language failing is an error worth reporting (blocked, rate limited, offline)
    if (parts.every((p) => p.status === "rejected")) throw (parts[0] as PromiseRejectedResult).reason;
    return parts.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
  }
}
