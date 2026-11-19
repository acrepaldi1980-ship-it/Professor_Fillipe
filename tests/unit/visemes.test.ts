import { describe, expect, it } from "vitest";
import { levelAt, planText, wordAt } from "@/lib/voice/visemes";

describe("text-driven mouth", () => {
  const plan = planText("Olá! Que bom ter você aqui, amigo.", 1);
  it("plans one entry per word, in order", () => {
    expect(plan.map((w) => w.start)).toEqual([0, 5, 9, 13, 17, 22, 28]);
    for (let i = 1; i < plan.length; i++) expect(plan[i].startMs).toBeGreaterThan(plan[i - 1].startMs);
  });
  it("opens wide on open vowels and closes between syllables", () => {
    const a = planText("aaa", 1)[0].syll[0];
    const peak = levelAt(planText("aaa", 1), a.atMs + a.durMs / 2);
    expect(peak).toBeGreaterThan(0.15);
    expect(levelAt(planText("aaa", 1), 1e6)).toBe(0);
  });
  it("is quieter for i/u than for a", () => {
    const pa = planText("a", 1)[0].syll[0];
    const pi = planText("i", 1)[0].syll[0];
    expect(levelAt(planText("a", 1), pa.atMs + pa.durMs / 2)).toBeGreaterThan(levelAt(planText("i", 1), pi.atMs + pi.durMs / 2));
  });
  it("pauses longer after a period than after a comma", () => {
    const p = planText("sim. sim, sim", 1);
    expect(p[1].startMs - p[0].endMs).toBeGreaterThan(p[2].startMs - p[1].endMs);
  });
  it("finds the word for a boundary index", () => {
    expect(wordAt(plan, 10)).toBe(2);
  });
});
