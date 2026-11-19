import { describe, expect, it } from "vitest";
import { buildSystemParts, LAYER_IDENTITY } from "../../lib/teacher/prompts";
import { summarizeSession } from "../../lib/teacher/summary";

describe("prompt layers from prompt_versions", () => {
  it("uses the built-in version 1 when there is no active override", () => {
    expect(buildSystemParts({ chunks: [], verses: [] }).stable).toContain(LAYER_IDENTITY.slice(0, 40));
  });
  it("uses the active override of the identity layer", () => {
    const p = buildSystemParts({ chunks: [], verses: [], layers: { identity: "IDENTIDADE NOVA v2" } });
    expect(p.stable).toContain("IDENTIDADE NOVA v2");
    expect(p.stable).not.toContain(LAYER_IDENTITY.slice(0, 40));
  });
});

describe("session summary", () => {
  const turns = [
    { role: "user" as const, text: "Quem foi Filipe?" },
    { role: "teacher" as const, text: "Filipe foi um dos sete diáconos. Quer ver Atos 8?" },
  ];
  it("parses the model's JSON", async () => {
    const llm = { complete: async () => 'texto {"summary":"Estudou Filipe e o eunuco etíope em Atos 8.","topics":["Atos 8"],"level_signal":"same"} fim' };
    const s = await summarizeSession(turns, "iniciante", llm);
    expect(s?.topics).toEqual(["Atos 8"]);
  });
  it("returns null for an invalid answer", async () => {
    expect(await summarizeSession(turns, "iniciante", { complete: async () => '{"summary":"x"}' })).toBeNull();
    expect(await summarizeSession(turns, "iniciante", { complete: async () => "nada" })).toBeNull();
  });
});
