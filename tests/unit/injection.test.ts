import { describe, expect, it } from "vitest";
import cases from "../../evals/datasets/injection.json";
import { injectionResponse, leaksPrompt, screenInput } from "@/lib/security/injection";
import { LAYER_IDENTITY } from "@/lib/teacher/prompts";
import { teacherResponseSchema } from "@/lib/teacher/schema";

// These must be stopped before the model: reveal prompt, change role, override rules, secrets.
const BLOCK = ["inj-01", "inj-02", "inj-03", "inj-04", "inj-05", "inj-09", "inj-11", "inj-12", "inj-13", "inj-14", "inj-16", "inj-21", "inj-22", "inj-25", "inj-27"];
// Legitimate study questions must never be blocked.
const OK = ["Quem foi Filipe em Atos 8?", "O que significa 'ignorar' a lei no Novo Testamento?", "Explique as regras do sábado em Êxodo 20", "Qual o papel de Moisés?", "Como Jesus agiu como mediador?", "Quais são as instruções de Deus em Levítico 11?", "Me explique a fé católica e a protestante"];

describe("input screen", () => {
  for (const c of cases.filter((c) => BLOCK.includes(c.id))) it(`blocks ${c.id}`, () => expect(screenInput(c.question)).not.toBeNull());
  for (const q of OK) it(`lets through: ${q}`, () => expect(screenInput(q)).toBeNull());
  it("the fixed replies are valid teacher responses with a closing question and admit being an AI", () => {
    for (const k of ["reveal_prompt", "change_role", "override_rules", "secrets"] as const) {
      const r = injectionResponse(k, "Marcos");
      expect(teacherResponseSchema.safeParse(r).success).toBe(true);
      expect(r.speech.trim().endsWith("?")).toBe(true);
      expect(r.speech.split(" ").length).toBeLessThanOrEqual(120);
    }
    expect(injectionResponse("change_role", "Ana").speech).toMatch(/inteligência artificial/);
  });
});

describe("leak detector", () => {
  it("catches copied instructions", () => expect(leaksPrompt(`Claro! ${LAYER_IDENTITY.slice(0, 300)}`)).toBe(true));
  it("does not call the sentences the prompt tells the teacher to say a leak (honest 'not found' answers were being replaced)", () => {
    expect(leaksPrompt("Ana, não encontrei isso nas minhas fontes. Quer que eu tente outro caminho?")).toBe(false);
    expect(leaksPrompt("Não encontrei isso nas minhas fontes, mas posso mostrar o texto bíblico.")).toBe(false);
  });
  it("still catches copied instructions around those sentences", () => expect(leaksPrompt(`Não encontrei isso nas minhas fontes. ${LAYER_IDENTITY.slice(600, 900)}`)).toBe(true));
  it("lets a normal answer through", () => expect(leaksPrompt("Filipe era um dos sete diáconos e pregou em Samaria. O que você já sabe sobre ele?")).toBe(false));
});
