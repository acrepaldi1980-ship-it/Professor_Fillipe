import { beforeEach, describe, expect, it } from "vitest";
import { cacheKey, depersonalize, eligibleQuestion, NAME_TOKEN, normalizeQuestion, personalize, worthKeeping, type AnswerCache } from "@/lib/teacher/answer-cache";
import { memory } from "@/lib/teacher/memory";
import { DEFAULT_STUDENT } from "@/lib/teacher/prompts";
import { runTurn, type TeacherLlm, type TurnDeps } from "@/lib/teacher/pipeline";
import type { TeacherResponse } from "@/lib/teacher/schema";
import type { Retrieved } from "@/lib/knowledge/search";

const base = { locale: "pt-BR", versionId: "por_blivre_2018", lenses: [] as string[], level: "intermediário", minor: false };
const R = (speech: string, over: Partial<TeacherResponse> = {}): TeacherResponse => ({ speech, display_markdown: "", citations: [{ type: "bible", ref: "1SA.16.13", version_id: "por_blivre_2018" }], visuals: [], next_options: [{ label: "Continuar", intent: "next" }, { label: "Parar", intent: "stop" }], lens_divergence: { present: false, summary: null }, pastoral_flag: false, level_signal: "same", mode_payload: null, external_sources: [], ...over }) as TeacherResponse;
const profile = { preferred_name: "Marlene", goals: [], ministry_role: null, last_summaries: [] as string[] };

describe("cache key", () => {
  it("ignores case, accents, punctuation and filler: the same question is the same key", () => {
    const k = (t: string) => cacheKey({ ...base, text: t });
    expect(k("Quem foi Davi?")).toBe(k("me fale sobre DAVI"));
    expect(k("quem foi Zaqueu?")).toBe(k("Me fale tudo sobre Zaqueu"));
    expect(k("O que é a graça?")).toBe(k("o que é a graca"));
    expect(k("Quem foi Davi?")).not.toBe(k("Quem foi Moisés?"));
  });
  it("changes with what changes the answer: language, version, lens, level, minor", () => {
    const k = (o: Partial<typeof base>) => cacheKey({ ...base, ...o, text: "O que é a graça?" });
    const ref = k({});
    for (const o of [{ locale: "es" }, { versionId: "eng_kjv" }, { lenses: ["reformed"] }, { level: "iniciante" }, { minor: true }]) expect(k(o), JSON.stringify(o)).not.toBe(ref);
    expect(k({ lenses: ["reformed", "baptist"] })).toBe(k({ lenses: ["baptist", "reformed"] }));
    expect(ref).toMatch(/^[0-9a-f]{64}$/);
  });
  it("does not keep the question text, only a hash", () => {
    expect(cacheKey({ ...base, text: "Quem foi Davi?" })).not.toContain("davi");
    expect(normalizeQuestion("Quem foi Davi?")).toBe(normalizeQuestion("Davi"));
  });
});

describe("what may use the cache", () => {
  const ok = { text: "Quem foi Davi?", intent: "ask", historyLength: 0, mode: "free", hasModeContext: false, hasExtraSources: false };
  it("only first, short, standalone questions of free study", () => {
    expect(eligibleQuestion(ok)).toBe(true);
    expect(eligibleQuestion({ ...ok, historyLength: 2 })).toBe(false);
    expect(eligibleQuestion({ ...ok, mode: "sermon" })).toBe(false);
    expect(eligibleQuestion({ ...ok, hasModeContext: true })).toBe(false);
    expect(eligibleQuestion({ ...ok, hasExtraSources: true })).toBe(false);
    expect(eligibleQuestion({ ...ok, intent: "deepen" })).toBe(false);
    expect(eligibleQuestion({ ...ok, text: "x" })).toBe(false);
    expect(eligibleQuestion({ ...ok, text: "a ".repeat(30) })).toBe(false);
  });
  it("only clean answers are kept", () => {
    const good = { degraded: false, pastoral: false, externalUsed: false, topicVerdict: "in", overWordLimit: false, removedCitations: 0, answered: true, response: R("Davi foi o segundo rei de Israel, escolhido por Deus quando ainda era pastor. Quer ver mais?") };
    expect(worthKeeping(good)).toBe(true);
    for (const o of [{ degraded: true }, { pastoral: true }, { externalUsed: true }, { topicVerdict: "unsure" }, { overWordLimit: true }, { removedCitations: 1 }, { answered: false }, { response: R("curto", {}) }, { response: R("Davi foi o segundo rei de Israel, escolhido por Deus quando ainda era pastor. Quer ver mais?", { citations: [] }) }]) expect(worthKeeping({ ...good, ...o }), JSON.stringify(o).slice(0, 40)).toBe(false);
  });
});

describe("nothing personal is shared", () => {
  it("replaces the student's name by a placeholder and puts the next student's name back", () => {
    const r = R("Marlene, Davi foi rei. Marlene, quer saber mais?", { next_options: [{ label: "Marlene, continuar", intent: "next" }] as never });
    const d = depersonalize(r, profile)!;
    expect(d.speech).toBe(`${NAME_TOKEN}, Davi foi rei. ${NAME_TOKEN}, quer saber mais?`);
    expect(d.next_options[0].label).toBe(`${NAME_TOKEN}, continuar`);
    expect(personalize(d, "Rafael").speech).toBe("Rafael, Davi foi rei. Rafael, quer saber mais?");
    expect(JSON.stringify(d)).not.toContain("Marlene");
  });
  it("does not keep an answer for a student whose name is also a Bible name (Davi, Ana, Pedro)", () => {
    expect(depersonalize(R("Davi, Davi foi rei."), { ...profile, preferred_name: "Davi" })).toBeNull();
    expect(depersonalize(R("Ana, foi assim."), { ...profile, preferred_name: "Ana" })).toBeNull();
    expect(depersonalize(R("ok"), { ...profile, preferred_name: "Jo" })).toBeNull();
  });
  it("does not keep an answer that repeats the student's goals, role or what was said in earlier sessions", () => {
    expect(depersonalize(R("Marlene, como professora de escola dominical, você pode usar isso na aula."), { ...profile, ministry_role: "professora de escola dominical" })).toBeNull();
    expect(depersonalize(R("Marlene, para o seu objetivo de entender o Apocalipse, veja isto."), { ...profile, goals: ["entender o Apocalipse"] })).toBeNull();
    expect(depersonalize(R("Marlene, como vimos na última vez, a perda do seu pai marcou você."), { ...profile, last_summaries: ["Falamos sobre a perda do seu pai e a esperança"] })).toBeNull();
    expect(depersonalize(R("Marlene, Davi foi rei."), { ...profile, goals: ["entender o Apocalipse"], last_summaries: ["Falamos sobre a perda do pai"] })).not.toBeNull();
  });
});

describe("pipeline with the shared cache", () => {
  const chunk = (): Retrieved => ({ id: "easton_1897:9", work_id: "easton_1897", text: "David\nSecond king of Israel.", title_path: "David", refs: [], tradition: "general", language: "en", tokens: 20, rrf: 0.03, signals: ["keyword", "semantic"], kind: "dictionary", layer: 1, weight: 1, score: 1 } as Retrieved);
  const good = { speech: "Marlene, Davi foi o segundo rei de Israel, escolhido por Deus quando ainda era pastor de ovelhas em Belém. Quer ver a história dele?", display_markdown: "", citations: [], visuals: [], next_options: [{ label: "Sim", intent: "ask" }, { label: "Parar", intent: "stop" }], lens_divergence: { present: false, summary: null }, pastoral_flag: false, level_signal: "same", mode_payload: null, sources_sufficient: true };
  const store = new Map<string, TeacherResponse>();
  const cache: AnswerCache = { get: async (k) => store.get(k) ?? null, put: async (k, r) => { store.set(k, r); } };
  let calls = 0;
  const llm: TeacherLlm = { generate: async () => { calls++; return good; } };
  const deps = (): TurnDeps => ({ llm, search: async () => ({ chunks: [chunk()], refs: [] }), getVerses: async () => [], existingVerses: async () => new Set<string>(), answerCache: cache });
  const ask = (text: string, name: string, over: Record<string, unknown> = {}) => runTurn({ sessionId: "c1", text, student: { ...DEFAULT_STUDENT, preferred_name: name }, ...over }, deps());
  beforeEach(() => { memory.clear("c1"); store.clear(); calls = 0; });

  it("a miss calls the model and offers a name-free entry; the next student gets it with their own name and no model call", async () => {
    const first = await ask("Quem foi Davi?", "Marlene");
    expect(calls).toBe(1);
    expect(first.meta.cache).toBeUndefined();
    // the answer cited nothing in this stub, so it is not offered: the cache only keeps answers with sources
    expect(first.cacheEntry).toBeUndefined();
    store.set(cacheKeyFor("Quem foi Davi?"), depersonalize({ ...R("Marlene, Davi foi o segundo rei de Israel, escolhido por Deus quando ainda era pastor. Quer ver mais?") }, profile)!);
    memory.clear("c1"); // another student, another conversation
    const second = await ask("me fale sobre Davi", "Rafael");
    expect(calls).toBe(1);
    expect(second.meta.cache).toBe("hit");
    expect(second.response.speech.startsWith("Rafael, Davi foi o segundo rei")).toBe(true);
  });
  it("a follow-up in a conversation never uses the cache", async () => {
    store.set(cacheKeyFor("Quem foi Davi?"), R(`${NAME_TOKEN}, resposta guardada para todos, com bastante texto para valer a pena guardar. Quer mais?`));
    const r = await ask("Quem foi Davi?", "Rafael", { history: [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }] });
    expect(r.meta.cache).toBeUndefined();
    expect(calls).toBe(1);
  });
  it("a different version or lens does not share the entry", async () => {
    store.set(cacheKeyFor("Quem foi Davi?"), R(`${NAME_TOKEN}, resposta guardada para todos, com bastante texto para valer a pena guardar. Quer mais?`));
    const r = await ask("Quem foi Davi?", "Rafael", { bible: { lenses: ["reformed"], main_version_id: "por_blivre_2018", main_version_name: "BL", compare_versions: [] } });
    expect(r.meta.cache).toBeUndefined();
  });
});

function cacheKeyFor(text: string) {
  return cacheKey({ text, locale: DEFAULT_STUDENT.locale ?? "pt-BR", versionId: "por_blivre_2018", lenses: [], level: DEFAULT_STUDENT.level, minor: DEFAULT_STUDENT.is_minor });
}
