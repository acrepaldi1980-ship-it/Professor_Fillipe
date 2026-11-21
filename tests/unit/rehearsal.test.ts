import { describe, expect, it } from "vitest";
import { compareRehearsals, computeMetrics, ModelAnalysis, outlineParts, paceLabel, partTimes, type Segment } from "@/lib/rehearsal/analyze";

const segs: Segment[] = [
  { start: 0, end: 10, text: "Bom dia irmãos, né, hoje vamos falar de graça." },
  { start: 10.5, end: 20, text: "A graça é imerecida, tipo um presente." },
  { start: 26, end: 36, text: "Então a segunda parte: Deus nos chama." },
  { start: 36, end: 60, text: "Concluindo, entregue a vida a Cristo." },
];
const text = segs.map((s) => s.text).join(" ");

describe("computeMetrics", () => {
  const m = computeMetrics(segs, text);
  it("measures time, words and pace", () => {
    expect(m.total_seconds).toBe(60);
    expect(m.words).toBe(29);
    expect(m.speaking_seconds).toBe(54);
    expect(m.wpm).toBe(33);
    expect(m.wpm_overall).toBe(29);
  });
  it("finds long pauses only", () => {
    expect(m.pauses.count).toBe(1);
    expect(m.pauses.longest_seconds).toBe(6);
  });
  it("counts crutch words", () => {
    expect(m.crutches.find((c) => c.word === "né")?.count).toBe(1);
    expect(m.crutches.find((c) => c.word === "tipo")?.count).toBe(1);
  });
  it("handles an empty recording", () => {
    const e = computeMetrics([], "");
    expect(e.wpm).toBe(0);
    expect(e.total_seconds).toBe(0);
  });
  it("labels the pace", () => {
    expect(paceLabel(90)).toBe("slow");
    expect(paceLabel(130)).toBe("ok");
    expect(paceLabel(180)).toBe("fast");
    expect(paceLabel(0)).toBe("unknown");
  });
});

describe("parts", () => {
  const parts = outlineParts({ introduction: "x", divisions: [{ title: "A graça" }, { title: "O chamado" }], conclusion: "y" });
  it("lists the parts that exist in order", () => {
    expect(parts.map((p) => p.key)).toEqual(["introduction", "division-1", "division-2", "conclusion"]);
  });
  it("times each part from the placement and rejects bad indexes", () => {
    const t = partTimes(parts, [{ part: "introduction", from: 0, to: 1 }, { part: "division-1", from: 1, to: 9 }, { part: "division-2", from: 2, to: 2 }, { part: "conclusion", from: null, to: null }], segs);
    expect(t[0]).toMatchObject({ found: true, seconds: 20 });
    expect(t[1].found).toBe(false);
    expect(t[2]).toMatchObject({ found: true, seconds: 10 });
    expect(t[3].found).toBe(false);
  });
});

describe("model output", () => {
  it("requires strengths and caps improvements at 3", () => {
    const base = { central_idea: { stated_early: true, clarity: 4, comment: "ok" }, transitions: { score: 3, comment: "ok" }, illustrations: { used: [], comment: "ok" }, fidelity: { score: 5, comment: "ok", issues: [] } };
    const imp = { what: "a", how: "b" };
    expect(ModelAnalysis.safeParse({ feedback: { ...base, strengths: ["a", "b", "c"], improvements: [imp, imp, imp] }, parts: [] }).success).toBe(true);
    expect(ModelAnalysis.safeParse({ feedback: { ...base, strengths: ["a"], improvements: [imp, imp, imp, imp] }, parts: [] }).success).toBe(false);
    expect(ModelAnalysis.safeParse({ feedback: { ...base, strengths: [], improvements: [] }, parts: [] }).success).toBe(false);
  });
});

describe("compareRehearsals", () => {
  const mk = (id: string, total: number, wpm: number, pauses: number, clarity: number, what: string) => ({
    id, created_at: "2026-11-21", metrics: { total_seconds: total, speaking_seconds: total, words: 100, wpm, wpm_overall: wpm, pauses: { count: pauses, longest_seconds: 3, total_seconds: 6 }, crutches: [{ word: "né", count: pauses, per_100_words: 3, flagged: true }] },
    feedback: { central_idea: { stated_early: true, clarity, comment: "" }, improvements: [{ what, how: "" }] }, parts: [{ key: "introduction", label: "Introdução", seconds: total / 2, words: 50, found: true }],
  });
  it("shows deltas, part times and the improvements asked before", () => {
    const c = compareRehearsals(mk("a", 300, 170, 5, 2, "Diga a ideia central logo"), mk("b", 330, 140, 2, 4, "x"));
    expect(c.deltas.find((d) => d.label === "wpm")).toMatchObject({ before: 170, after: 140 });
    expect(c.deltas.find((d) => d.label === "central_idea")).toMatchObject({ before: 2, after: 4, better: "up" });
    expect(c.deltas.find((d) => d.label === "crutches")).toMatchObject({ before: 5, after: 2, better: "down" });
    expect(c.partDeltas[0]).toEqual({ label: "Introdução", before: 150, after: 165 });
    expect(c.addressed).toEqual(["Diga a ideia central logo"]);
  });
});
