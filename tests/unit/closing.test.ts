import { describe, expect, it } from "vitest";
import { evaluateAnswer, generateClosing, heuristicVerdict } from "../../lib/review/closing";

const turns = [
  { role: "user" as const, text: "Quem foi Filipe em Atos 8?" },
  { role: "teacher" as const, text: "Filipe foi um dos sete diáconos e levou o evangelho a Samaria e ao eunuco etíope. Quer ver Atos 8:30?" },
  { role: "user" as const, text: "Sim" },
];
const good = JSON.stringify({
  summary: "Ana, hoje você estudou Filipe, um dos sete diáconos, que levou o evangelho a Samaria e ao eunuco etíope em Atos 8. Ele perguntou: entendes o que lês? Seu desafio é explicar um texto a alguém esta semana.",
  mind_map: { nodes: [{ id: "n1", label: "Filipe", group: "center" }, { id: "n2", label: "Samaria", group: "topic" }, { id: "n3", label: "Eunuco etíope", group: "topic" }], edges: [{ from: "n1", to: "n2" }, { from: "n1", to: "n3" }, { from: "n1", to: "ghost" }] },
  cards: [
    { question: "Por que Filipe perguntou ao eunuco se ele entendia o que lia?", answer: "Para abrir a conversa e explicar Isaías a partir da dúvida dele.", ref: "ACT.8.30" },
    { question: "O que o eunuco estava lendo?", answer: "O livro do profeta Isaías." },
    { question: "Qual era a função de Filipe na igreja antes de Samaria?", answer: "Um dos sete escolhidos para servir às mesas." },
  ],
});

describe("session closing", () => {
  it("builds summary, mind map and 3 to 7 cards, dropping links to missing nodes", async () => {
    const c = await generateClosing(turns, "Ana", { complete: async () => `ok ${good} fim` });
    expect(c?.cards.length).toBeGreaterThanOrEqual(3);
    expect(c?.mind_map.edges).toHaveLength(2);
    expect(c?.summary.split(/\s+/).length).toBeLessThanOrEqual(320);
  });
  it("retries once and gives up on invalid output", async () => {
    let n = 0;
    expect(await generateClosing(turns, "Ana", { complete: async () => (++n === 1 ? "nada" : good) })).not.toBeNull();
    expect(await generateClosing(turns, "Ana", { complete: async () => '{"summary":"curto"}' })).toBeNull();
  });
  it("rejects fewer than 3 cards", async () => {
    const bad = JSON.stringify({ ...JSON.parse(good), cards: [{ question: "Pergunta longa o bastante?", answer: "ok" }] });
    expect(await generateClosing(turns, "Ana", { complete: async () => bad })).toBeNull();
  });
});

describe("grading a spoken answer", () => {
  const card = { question: "O que o eunuco estava lendo?", answer: "O livro do profeta Isaías." };
  it("uses the model's verdict and feedback", async () => {
    const e = await evaluateAnswer(card, "Isaías", "Ana", { complete: async () => '{"verdict":"right","feedback":"Isso mesmo, Ana!"}' });
    expect(e).toEqual({ verdict: "right", feedback: "Isso mesmo, Ana!" });
  });
  it("falls back to a keyword heuristic when the model fails", async () => {
    const down = { complete: async (): Promise<string> => { throw new Error("402"); } };
    expect((await evaluateAnswer(card, "o profeta Isaías", "Ana", down)).verdict).toBe("right");
    expect((await evaluateAnswer(card, "não lembro", "Ana", down)).verdict).toBe("wrong");
    expect(heuristicVerdict("Para abrir a conversa e explicar Isaías", "explicar Isaías")).toBe("partial");
  });
});
