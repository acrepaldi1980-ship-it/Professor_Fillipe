import { beforeEach, describe, expect, it, vi } from "vitest";
import { memory } from "@/lib/teacher/memory";
import { runTurn, type TeacherLlm, type TurnDeps } from "@/lib/teacher/pipeline";
import type { Retrieved } from "@/lib/knowledge/search";
import type { WebSource } from "@/lib/websearch/types";
import { DEFAULT_STUDENT } from "@/lib/teacher/prompts";

const chunk = (signals = ["keyword", "semantic"]): Retrieved => ({ id: "easton_1897:1", work_id: "easton_1897", text: "Carmel\nA mountain range in Palestine, famous for Elijah.", title_path: "CARMEL", refs: [], tradition: "general", kind: "dictionary", language: "en", tokens: 20, rrf: 0.02, signals, layer: 5, weight: 0.7, score: 0.014 });
const WEB: WebSource = { provider: "wikipedia", title: "Monte Carmelo", url: "https://pt.wikipedia.org/wiki/Monte_Carmelo", site: "Wikipédia (pt)", lang: "pt", license: "CC BY-SA 4.0", passages: ["Monte Carmelo é uma montanha em Israel.", "Altitude | 545 metro (1 724 pés) |"], retrievedAt: "2026-11-23T00:00:00Z" };
const reply = (speech: string, over: Record<string, unknown> = {}) => ({ speech, display_markdown: "", citations: [], visuals: [], next_options: [{ label: "Continuar", intent: "next" }, { label: "Parar", intent: "stop" }], ...over });

function setup(opts: { chunks?: Retrieved[]; replies: unknown[]; web?: WebSource[] }) {
  let i = 0;
  const systems: string[] = [];
  const llm: TeacherLlm = { generate: async (a) => { systems.push(a.system); return opts.replies[Math.min(i++, opts.replies.length - 1)]; } };
  const webSearch = vi.fn(async () => opts.web ?? [WEB]);
  const deps: TurnDeps = { llm, search: async () => ({ chunks: opts.chunks ?? [], refs: [] }), getVerses: async () => [], existingVerses: async () => new Set<string>(), webSearch };
  return { deps, webSearch, systems, get llmCalls() { return i; } };
}
const ask = (text: string, d: TurnDeps, over: Record<string, unknown> = {}) => runTurn({ sessionId: "s1", text, student: { ...DEFAULT_STUDENT, preferred_name: "Ana" }, ...over }, d);
beforeEach(() => memory.clear("s1"));

describe("guardrail: off-topic questions never reach the model or the web", () => {
  it("answers with the fixed invitation back to the study", async () => {
    const t = setup({ chunks: [chunk()], replies: [reply("não deveria ser chamado")] });
    const r = await ask("Quem ganhou o jogo do Flamengo ontem?", t.deps);
    expect(t.llmCalls).toBe(0);
    expect(t.webSearch).not.toHaveBeenCalled();
    expect(r.response.speech).toContain("só respondo dentro do estudo das Escrituras");
    expect(r.response.external_sources).toEqual([]);
    expect(r.meta.topic?.verdict).toBe("off");
  });
  it("an unclear question goes to the model with a reminder, but never to the web", async () => {
    const t = setup({ replies: [reply("Só ajudo dentro do estudo da Bíblia. Quer voltar a ele?")] });
    await ask("Me explique a teoria da relatividade", t.deps);
    expect(t.webSearch).not.toHaveBeenCalled();
    expect(t.systems[0]).toContain("não está claro que esta pergunta seja sobre a Bíblia");
  });
});

describe("research outside the app", () => {
  it("nothing found in the app: researches before the model and the answer says it came from outside, with the sources", async () => {
    const t = setup({ chunks: [], replies: [reply("O Monte Carmelo tem 545 metros de altitude, segundo a fonte. Quer saber mais sobre Elias ali?")] });
    const r = await ask("Qual é a altura do Monte Carmelo?", t.deps);
    expect(t.webSearch).toHaveBeenCalledTimes(1);
    expect(t.systems[0]).toContain("FONTES EXTERNAS");
    expect(t.systems[0]).toContain("Altitude | 545 metro");
    expect(r.response.speech.startsWith("Isso não está no acervo do app; pesquisei fora do app, em Wikipédia (pt)")).toBe(true); // the model forgot: the server adds it
    expect(r.response.external_sources).toEqual([{ title: "Monte Carmelo", url: "https://pt.wikipedia.org/wiki/Monte_Carmelo", site: "Wikipédia (pt)", lang: "pt", license: "CC BY-SA 4.0", retrieved_at: "2026-11-23T00:00:00Z" }]);
    expect(r.meta.external).toMatchObject({ tried: true, sources: 1, used: true });
  });

  it("the model says the app's passages do not answer: researches then and answers again", async () => {
    const t = setup({ chunks: [chunk()], replies: [reply("Não encontrei isso nas minhas fontes. Quer outro caminho?"), reply("Isso não está no acervo do app; pesquisei fora do app, na Wikipédia, e o Monte Carmelo tem 545 metros. Quer ver Elias lá?")] });
    const r = await ask("Qual é a altura do Monte Carmelo?", t.deps);
    expect(t.llmCalls).toBe(2);
    expect(t.webSearch).toHaveBeenCalledTimes(1);
    expect(t.systems[1]).toContain("FONTES EXTERNAS");
    expect(r.response.speech).toContain("545 metros");
    expect(r.response.external_sources?.length).toBe(1);
  });

  it("the app answers: the web is never touched", async () => {
    const t = setup({ chunks: [chunk()], replies: [reply("O Carmelo é uma cadeia de montes na Palestina, ligada a Elias. Quer ver no mapa?", { sources_sufficient: true })] });
    const r = await ask("Onde fica o monte Carmelo?", t.deps);
    expect(t.webSearch).not.toHaveBeenCalled();
    expect(r.response.external_sources).toEqual([]);
    expect(r.meta.external?.tried).toBe(false);
  });

  it("nothing found outside either: no sources are attached and the answer says so", async () => {
    const t = setup({ chunks: [], web: [], replies: [reply("Não encontrei isso nem no acervo nem na pesquisa fora do app. Quer outro caminho?")] });
    const r = await ask("Qual é a altura do Monte Carmelo?", t.deps);
    expect(r.response.external_sources).toEqual([]);
    expect(r.meta.external).toMatchObject({ tried: true, sources: 0, used: false, reason: "no_pages" });
  });

  it("a number the pages do not carry is never spoken: one retry, then the plain words of the source", async () => {
    const t = setup({ chunks: [], replies: [reply("Pesquisei fora do app: o Monte Carmelo tem 700 metros. Quer saber mais?"), reply("Pesquisei fora do app: o Monte Carmelo tem 700 metros, tenho certeza. Quer saber mais?")] });
    const r = await ask("Qual é a altura do Monte Carmelo?", t.deps);
    expect(r.response.speech).not.toContain("700");
    expect(r.response.speech).toContain("não consegui conferir esse número");
    expect(r.response.display_markdown).toContain("545 metro");
  });

  it("minors are never sent to the web", async () => {
    const t = setup({ chunks: [], replies: [reply("Não encontrei isso nas minhas fontes. Quer outro caminho?")] });
    const r = await runTurn({ sessionId: "s1", text: "Qual é a altura do Monte Carmelo?", student: { ...DEFAULT_STUDENT, preferred_name: "Ana", is_minor: true } }, t.deps);
    expect(t.webSearch).not.toHaveBeenCalled();
    expect(r.response.external_sources).toEqual([]);
  });

  it("guided modes (lesson, sermon) do their own research and never use the web", async () => {
    const t = setup({ chunks: [], replies: [reply("Não encontrei isso nas minhas fontes. Quer outro caminho?")] });
    await ask("Qual é a altura do Monte Carmelo?", t.deps, { mode: "lesson" });
    expect(t.webSearch).not.toHaveBeenCalled();
  });
});
