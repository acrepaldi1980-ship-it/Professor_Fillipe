import { describe, expect, it } from "vitest";
import { classify, classifierModel, extractRefs, isFollowUp, moderate, resolveSearch, selectTier, wordLimit } from "../../lib/teacher/stages";

describe("1. moderation", () => {
  it("flags a crisis before any generation", () => {
    expect(moderate("Não aguento mais, quero me matar").crisis).toBe(true);
    expect(moderate("Jesus morreu na cruz por quem?").crisis).toBe(false);
  });
});

describe("2. intents and voice commands (8.5.2)", () => {
  const table: [string, string][] = [
    ["Quem foi Barnabé?", "ask"],
    ["Aprofunda", "deepen"],
    ["explica melhor", "deepen"],
    ["vai mais fundo", "deepen"],
    ["Explica mais simples", "simplify"],
    ["não entendi", "simplify"],
    ["Me dá um exemplo", "example"],
    ["Mostra no mapa", "show_map"],
    ["Coloca isso numa linha do tempo", "show_timeline"],
    ["Como outras versões traduzem?", "compare_versions"],
    ["E as outras igrejas, o que pensam?", "other_traditions"],
    ["Pode seguir", "next"],
    ["próximo", "next"],
    ["Para", "stop"],
    ["chega por hoje", "stop"],
  ];
  for (const [said, intent] of table) it(`"${said}" -> ${intent}`, () => expect(classify(said)).toBe(intent));
  it("an intent sent by a button wins over the text", () => expect(classify("qualquer coisa", "show_map")).toBe("show_map"));
});

describe("3. references", () => {
  it("extracts canonical references from pt-BR text", () => {
    expect(extractRefs("Explique João 3:16 e Atos 8:26-40")).toEqual(expect.arrayContaining(["JHN.3.16"]));
    expect(extractRefs("Quem foi Davi?")).toEqual([]);
  });
});

describe("4. follow-ups and search text", () => {
  it("a short question leans on the previous turn", () => {
    expect(isFollowUp("e o irmão mais velho?", false, "ask")).toBe(true);
    expect(isFollowUp("Explique detalhadamente a doutrina da justificação pela fé em Romanos", false, "ask")).toBe(false);
    expect(isFollowUp("Aprofunde", true, "deepen")).toBe(false);
  });
  it("borrows subject and references only for follow-ups", () => {
    const history = [{ role: "user" as const, content: "Parábola do filho pródigo" }, { role: "assistant" as const, content: "..." }];
    const r = resolveSearch({ text: "aprofunde esse texto", intent: "deepen", mentioned: [], history, lastRefs: ["LUK.15.11"] });
    expect(r.searchText).toContain("filho pródigo");
    expect(r.carriedRefs).toEqual(["LUK.15.11"]);
    const fresh = resolveSearch({ text: "Explique detalhadamente a doutrina da justificação pela fé em Romanos", intent: "ask", mentioned: [], history, lastRefs: ["LUK.15.11"] });
    expect(fresh.carriedRefs).toEqual([]);
  });
});

describe("6. model choice (8.5.3)", () => {
  it("fast for plain questions, deep for deepening, materials and 3+ traditions", () => {
    expect(selectTier({ intent: "ask" })).toBe("fast");
    expect(selectTier({ intent: "deepen" })).toBe("deep");
    expect(selectTier({ intent: "ask", mode: "deep" })).toBe("deep");
    expect(selectTier({ intent: "ask", mode: "sermon" })).toBe("deep");
    expect(selectTier({ intent: "ask", lenses: ["baptist", "reformed", "wesleyan"] })).toBe("deep");
    expect(selectTier({ intent: "ask", lenses: ["baptist"] })).toBe("fast");
  });
  it("word limits and classifier model", () => {
    expect(wordLimit("ask")).toBe(120);
    expect(wordLimit("deepen")).toBe(250);
    expect(classifierModel()).toContain("haiku");
  });
});
