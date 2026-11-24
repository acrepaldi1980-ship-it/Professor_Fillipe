import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attributeTerms, entityPhrase, htmlToText, isBiblicalPage, pickPassages } from "@/lib/websearch/text";
import { WikipediaProvider } from "@/lib/websearch/wikipedia";
import { TavilyProvider } from "@/lib/websearch/tavily";
import { resetWebSearchCache, webSearch } from "@/lib/websearch";
import type { WebSearchProvider, WebSource } from "@/lib/websearch/types";

describe("what the question is about", () => {
  it("takes the subject, not the whole sentence", () => {
    expect(entityPhrase("Qual é a altura do Monte Carmelo?")).toBe("monte carmelo");
    expect(entityPhrase("Quantos habitantes tem Jerusalém hoje?")).toBe("jerusalem");
    expect(entityPhrase("Qual o tamanho da Arca de Noé?")).toBe("arca noe");
  });
  it("recognises what is asked and the English words for it", () => {
    const a = attributeTerms("Qual é a altura do Monte Carmelo?");
    expect(a.asked).toEqual(["altura"]);
    expect(a.terms).toContain("elevation");
    expect(attributeTerms("Quem foi Davi?").asked).toEqual([]);
  });
});

describe("reading a page", () => {
  const html = `<p>O <b>Monte Carmelo</b> é uma montanha em Israel.<sup>[1]</sup></p><style>.x{}</style><table><tr><th>Altitude</th><td>545 metro (1&nbsp;724 pés)</td></tr></table><p>Segundo a Bíblia, Elias desafiou os profetas de Baal ali.</p><p>Outra linha sem relação nenhuma com a pergunta feita aqui.</p>`;
  it("turns HTML into plain text without scripts, styles or citation marks", () => {
    const t = htmlToText(html);
    expect(t).toContain("Altitude | 545 metro (1 724 pés)");
    expect(t).not.toMatch(/<|\.x\{|\[1\]/);
  });
  it("keeps the lead and the lines that answer a measurement, in page order", () => {
    const text = htmlToText(html);
    const p = pickPassages(text, "altura do monte carmelo", { terms: attributeTerms("altura").terms });
    expect(p[0]).toContain("montanha em Israel");
    expect(p.some((l) => l.includes("545"))).toBe(true);
  });
  it("tells a page of the biblical world from another", () => {
    expect(isBiblicalPage("A montanha em Israel onde, segundo a Bíblia, Elias desafiou os profetas.")).toBe(true);
    expect(isBiblicalPage("Time de voleibol masculino sediado em Minas Gerais, campeão da Superliga B.")).toBe(false);
  });
});

/** A fake Wikipedia: `pages` by title; the search returns the given titles in order. */
function fakeWiki(search: Record<string, string[]>, pages: Record<string, string>, calls: string[] = []) {
  return vi.fn(async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    if (u.searchParams.get("list") === "search") return Response.json({ query: { search: (search[u.hostname.slice(0, 2)] ?? []).map((title) => ({ title })) } });
    const title = u.searchParams.get("page")!;
    return pages[title] ? Response.json({ parse: { title, text: pages[title] } }) : Response.json({});
  }) as unknown as typeof fetch;
}
const CARMEL = "<p>O Monte Carmelo é uma montanha em Israel. Segundo a Bíblia, o profeta Elias desafiou os sacerdotes de Baal ali.</p><table><tr><th>Altitude</th><td>545 metros</td></tr></table>";
const TEAM = "<p>Time de voleibol masculino sediado em Monte Carmelo, Minas Gerais, campeão da Superliga B.</p>";

describe("Wikipedia provider", () => {
  it("finds the article of the subject, reads it and returns the passage that answers, with credit", async () => {
    const f = fakeWiki({ pt: ["Monte Carmelo (Minas Gerais)", "Monte Carmelo"] }, { "Monte Carmelo": CARMEL, "Monte Carmelo (Minas Gerais)": TEAM });
    const out = await new WikipediaProvider(f, ["pt"]).search({ question: "Qual é a altura do Monte Carmelo?" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ provider: "wikipedia", title: "Monte Carmelo", site: "Wikipédia (pt)", license: "CC BY-SA 4.0", url: "https://pt.wikipedia.org/wiki/Monte_Carmelo" });
    expect(out[0].passages.join(" ")).toContain("545 metros");
  });
  it("an exact title wins alone: the other pages are not even read", async () => {
    const calls: string[] = [];
    const f = fakeWiki({ pt: ["Monte Carmelo", "Monte Carmelo Center"] }, { "Monte Carmelo": CARMEL }, calls);
    await new WikipediaProvider(f, ["pt"]).search({ question: "Qual é a altura do Monte Carmelo?" });
    expect(calls.filter((c) => c.includes("action=parse")).length).toBe(1);
  });
  it("discards pages that are not about the biblical world", async () => {
    const f = fakeWiki({ pt: ["Monte Carmelo"] }, { "Monte Carmelo": TEAM });
    expect(await new WikipediaProvider(f, ["pt"]).search({ question: "Qual é a altura do Monte Carmelo?" })).toEqual([]);
  });
  it("waits and tries again when Wikipedia answers 429, and reports a failure instead of hiding it", async () => {
    let n = 0;
    const f = vi.fn(async (url: string) => {
      if (new URL(url).searchParams.get("list") === "search") { n++; return n === 1 ? new Response("slow down", { status: 429, headers: { "retry-after": "0" } }) : Response.json({ query: { search: [{ title: "Monte Carmelo" }] } }); }
      return Response.json({ parse: { title: "Monte Carmelo", text: CARMEL } });
    }) as unknown as typeof fetch;
    expect((await new WikipediaProvider(f, ["pt"]).search({ question: "Altura do Monte Carmelo" })).length).toBe(1);
    const broken = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(new WikipediaProvider(broken, ["pt"]).search({ question: "Altura do Monte Carmelo" })).rejects.toThrow("wikipedia_500");
  });
  it("uses the English keywords as the subject of the English pages", async () => {
    const calls: string[] = [];
    const f = fakeWiki({ en: ["Mount Carmel"] }, { "Mount Carmel": "<p>Mount Carmel is a coastal mountain range in Israel. According to the Bible, Elijah met the prophets of Baal there.</p>" }, calls);
    const out = await new WikipediaProvider(f, ["en"]).search({ question: "Qual é a altura do Monte Carmelo?", english: "mount carmel, height" });
    expect(calls[0]).toContain("srsearch=mount+carmel");
    expect(out[0].site).toBe("Wikipedia (en)");
  });
});

describe("Tavily provider (optional, with a key)", () => {
  it("maps results to sources with the site name and the passage", async () => {
    const f = vi.fn(async () => Response.json({ results: [{ title: "Monte Carmelo", url: "https://www.example.org/carmelo", content: "O Monte Carmelo tem 546 metros." }] })) as unknown as typeof fetch;
    const out = await new TavilyProvider("key", f).search({ question: "altura do Monte Carmelo" });
    expect(out[0]).toMatchObject({ provider: "tavily", site: "example.org", passages: ["O Monte Carmelo tem 546 metros."] });
    expect((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer key" });
  });
  it("ignores an answer that does not match the contract", async () => {
    const f = vi.fn(async () => Response.json({ results: "nope" })) as unknown as typeof fetch;
    expect(await new TavilyProvider("key", f).search({ question: "x" })).toEqual([]);
  });
});

describe("web search entry point", () => {
  const src = (url: string): WebSource => ({ provider: "wikipedia", title: "T", url, site: "Wikipédia (pt)", lang: "pt", license: "CC BY-SA 4.0", passages: ["p"], retrievedAt: "now" });
  const provider = (list: WebSource[], delay = 0): WebSearchProvider & { calls: number } => { const p = { name: "fake", calls: 0, async search() { p.calls++; if (delay) await new Promise((r) => setTimeout(r, delay)); return list; } }; return p; };
  beforeEach(() => { resetWebSearchCache(); delete process.env.WEB_SEARCH; });
  afterEach(() => { delete process.env.WEB_SEARCH; });

  it("merges providers, drops repeated pages, limits to four and caches the answer", async () => {
    const a = provider([src("https://a/1"), src("https://a/2")]), b = provider([src("https://a/1"), src("https://b/3"), src("https://b/4"), src("https://b/5")]);
    const out = await webSearch({ question: "q" }, { providers: [a, b] });
    expect(out.map((s) => s.url)).toEqual(["https://a/1", "https://a/2", "https://b/3", "https://b/4"]);
    await webSearch({ question: "q" }, { providers: [a, b] });
    expect(a.calls).toBe(1);
  });
  it("never throws and never waits longer than the budget", async () => {
    const slow = provider([src("https://slow/1")], 400);
    const bad: WebSearchProvider = { name: "bad", search: async () => { throw new Error("boom"); } };
    expect(await webSearch({ question: "q2" }, { providers: [bad] })).toEqual([]);
    const t0 = Date.now();
    await webSearch({ question: "q3" }, { providers: [slow], timeoutMs: 50 });
    expect(Date.now() - t0).toBeLessThan(350 + 400); // it returns when the provider settles or the budget ends; it must not hang
  });
  it("is off with WEB_SEARCH=off", async () => {
    process.env.WEB_SEARCH = "off";
    const p = provider([src("https://a/1")]);
    expect(await webSearch({ question: "q4" }, { providers: [p] })).toEqual([]);
    expect(p.calls).toBe(0);
  });
});

import { webSearchDetailed } from "@/lib/websearch";
describe("failures are reported, not hidden", () => {
  it("names the provider and the reason when a provider fails, and still returns what the others found", async () => {
    resetWebSearchCache();
    const good: WebSearchProvider = { name: "ok", search: async () => [{ provider: "wikipedia", title: "T", url: "https://x/1", site: "S", lang: "pt", license: "L", passages: ["p"], retrievedAt: "now" }] };
    const bad: WebSearchProvider = { name: "wikipedia", search: async () => { throw new Error("wikipedia_429"); } };
    const r = await webSearchDetailed({ question: "qq" }, { providers: [bad, good] });
    expect(r.errors).toEqual(["wikipedia:wikipedia_429"]);
    expect(r.sources).toHaveLength(1);
  });
  it("the Wikipedia provider throws only when EVERY language failed", async () => {
    const f = vi.fn(async () => new Response("", { status: 403 })) as unknown as typeof fetch;
    await expect(new WikipediaProvider(f, ["pt", "en"]).search({ question: "Altura do Monte Carmelo" })).rejects.toThrow("wikipedia_403");
  });
});

describe("measures on infobox rows", () => {
  it("a row whose label is what the question asks beats the sentences that merely mention the subject", () => {
    const text = [
      "Jerusalém é uma cidade no Oriente Médio, sagrada para judeus, cristãos e muçulmanos.",
      "A população cresceu 2,1% em 2019 e 1,8% em 2020, segundo estimativas oficiais do governo.",
      "Habitantes (2022) | 981 711 |",
      "A cidade foi conquistada por Davi e depois por Nabucodonosor, e reconstruída por Esdras e Neemias.",
    ].join("\n");
    const p = pickPassages(text, "jerusalem", { terms: attributeTerms("Quantos habitantes tem Jerusalém?").terms });
    expect(p.some((l) => l.includes("981 711"))).toBe(true);
  });
  it("time words are not part of the subject", () => {
    expect(entityPhrase("Quantos habitantes tem Jerusalém hoje?")).toBe("jerusalem");
  });
});

describe("the subject comes from the question, not from the last turn", () => {
  it("uses the conversation only when the question has no subject of its own", async () => {
    const calls: string[] = [];
    const f = fakeWiki({ pt: ["Monte Sinai"] }, { "Monte Sinai": "<p>O Monte Sinai, segundo a Bíblia, é onde Moisés recebeu a Lei em Israel.</p>" }, calls);
    await new WikipediaProvider(f, ["pt"]).search({ question: "E a altitude?", context: "Qual é a altitude do Monte Sinai? E a altitude?" });
    expect(calls[0]).toContain("srsearch=monte+sinai");
    const calls2: string[] = [];
    await new WikipediaProvider(fakeWiki({ pt: [] }, {}, calls2), ["pt"]).search({ question: "Quantos habitantes tem Belém hoje?", context: "Qual é a altitude do Monte Sinai?" });
    expect(calls2[0]).toContain("srsearch=belem");
    expect(calls2[0]).not.toContain("sinai");
  });
  it("tries every page with the exact title: the Brazilian city is discarded and Bethlehem is read", async () => {
    const f = fakeWiki({ pt: ["Belém", "Belém (Cisjordânia)"] }, { "Belém": "<p>Belém é um município do estado do Pará, no Brasil, capital paraense.</p>", "Belém (Cisjordânia)": "<p>Belém é uma cidade da Cisjordânia, local do nascimento de Jesus segundo a Bíblia, em Israel e na Palestina.</p>" });
    const out = await new WikipediaProvider(f, ["pt"]).search({ question: "Quantos habitantes tem Belém hoje?" });
    expect(out.map((s) => s.title)).toEqual(["Belém (Cisjordânia)"]);
  });
});

describe("what counts as a page of the biblical world", () => {
  it("skips disambiguation pages and a parish of Lisbon that merely mentions a church", async () => {
    const f = fakeWiki({ pt: ["Belém (desambiguação)", "Belém (Lisboa)", "Belém (Cisjordânia)"] }, {
      "Belém (desambiguação)": "<p>Belém pode referir-se a: Belém (Cisjordânia), Belém (Lisboa). Bíblia Jesus Israel.</p>",
      "Belém (Lisboa)": "<p>Belém é uma freguesia de Lisboa, famosa pelo mosteiro e pela igreja de Santa Maria, com um templo manuelino.</p>",
      "Belém (Cisjordânia)": "<p>Belém é uma cidade da Cisjordânia, local do nascimento de Jesus segundo a Bíblia, onde nasceu Davi, em Israel.</p>",
    });
    const out = await new WikipediaProvider(f, ["pt"]).search({ question: "Quantos habitantes tem Belém?" });
    expect(out.map((s) => s.title)).toEqual(["Belém (Cisjordânia)"]);
  });
});
