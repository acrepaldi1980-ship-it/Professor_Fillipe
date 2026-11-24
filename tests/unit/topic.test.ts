import { describe, expect, it } from "vitest";
import { offTopicResponse, topicGate } from "@/lib/teacher/topic";
import { teacherResponseSchema } from "@/lib/teacher/schema";
import type { Retrieved } from "@/lib/knowledge/search";

const gate = (text: string, extra: Partial<Parameters<typeof topicGate>[0]> = {}) => topicGate({ text, refs: [], chunks: [], ...extra });
const chunk = (title: string, signals: string[], kind = "dictionary"): Retrieved => ({ id: "x", work_id: "w", text: "", title_path: title, refs: [], tradition: "general", kind, language: "en", tokens: 100, rrf: 0.03, signals, layer: 5, weight: 0.7, score: 0.02 });

describe("topic guardrail: the teacher stays inside the biblical context", () => {
  it.each([
    "O que a Bíblia diz sobre o perdão?",
    "Qual é a altura do Monte Carmelo?",
    "Quem foi Rute e o que ela fez por Noemi?",
    "Como era o Templo de Salomão por dentro?",
    "Josefo fala de Tiago, o irmão de Jesus?",
    "Qual a diferença entre o grego koiné e o hebraico bíblico?",
    "Por que os fariseus condenaram Jesus?",
    "O que significa a palavra ágape no Novo Testamento?",
    "Me explique a doutrina da Trindade segundo os credos",
    "Onde fica Belém e por que ela é importante?",
  ])("accepts: %s", (q) => expect(gate(q).verdict).toBe("in"));

  it.each([
    "Quem ganhou o jogo do Flamengo ontem?",
    "Me passa uma receita de bolo de cenoura",
    "Quanto custa o iPhone do Pedro?",
    "Em quem devo votar nas eleições?",
    "Escreva um código em Python para ordenar uma lista",
    "Qual o preço do bitcoin hoje?",
    "Qual é a melhor série da Netflix?",
    "Qual o meu signo e o meu horóscopo de hoje?",
  ])("blocks: %s", (q) => expect(gate(q).verdict).toBe("off"));

  it("does not decide when nothing is clear: no web search, the teacher handles it (unsure)", () => {
    expect(gate("Me explique a teoria da relatividade").verdict).toBe("unsure");
    expect(gate("Como funciona o motor de um carro?").verdict).toBe("unsure");
  });

  it("a Bible reference, a study screen and a short follow-up keep the conversation in context", () => {
    expect(gate("e esse versículo?", { refs: ["JHN.3.16"] }).verdict).toBe("in");
    expect(gate("explica melhor", { inStudyContext: true }).verdict).toBe("in");
    expect(gate("sim, continue", { followUp: true }).verdict).toBe("in");
    expect(gate("sim, continue").verdict).toBe("unsure");
  });

  it("an off-topic question stays off topic in the middle of a study, a follow-up or a study screen", () => {
    expect(gate("Quem ganhou o jogo do Flamengo ontem?", { followUp: true }).verdict).toBe("off");
    expect(gate("Quem ganhou o jogo do Flamengo ontem?", { inStudyContext: true }).verdict).toBe("off");
    expect(gate("Quanto custa o iPhone?", { inStudyContext: true, followUp: true }).verdict).toBe("off");
  });
  it("a short question with no subject of its own is not biblical just because the last answer was", () => {
    expect(gate("e o resultado de ontem?", { followUp: true }).verdict).toBe("unsure");
  });

  it("a common name alone is biblical, but not when the sentence is about something else", () => {
    expect(gate("Quem foi Paulo?").verdict).toBe("in");
    expect(gate("Paulo comprou um celular novo").verdict).toBe("off");
  });

  it("the library knowing the subject (entry found by keyword AND meaning) counts as biblical", () => {
    expect(gate("o que é o urim e tumim", { chunks: [chunk("URIM AND THUMMIM", ["keyword", "semantic"])] }).verdict).toBe("in");
    expect(gate("o que é o urim e tumim", { chunks: [chunk("URIM AND THUMMIM", ["semantic"])] }).verdict).toBe("unsure");
  });

  it("the fixed reply is valid, short, kind and ends with a choice", () => {
    const r = offTopicResponse("Ana");
    expect(teacherResponseSchema.safeParse(r).success).toBe(true);
    expect(r.speech.split(/\s+/).length).toBeLessThanOrEqual(60);
    expect(r.speech.trim().endsWith("?")).toBe(true);
    expect(r.speech).toContain("Ana");
  });
});
