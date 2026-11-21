import { describe, expect, it } from "vitest";
import { computeStreak, reachedStreakMilestones, todayIn } from "@/lib/engagement/streak";
import { getPath, PATHS } from "@/lib/paths/data";
import { layerTrail } from "@/lib/teacher/prompts";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-11-21", "2026-11-20", "2026-11-19"], "2026-11-21")).toEqual({ current: 3, best: 3, total_days: 3, studied_today: true });
  });
  it("stays alive until the end of today when yesterday was studied", () => {
    const s = computeStreak(["2026-11-20", "2026-11-19"], "2026-11-21");
    expect(s.current).toBe(2);
    expect(s.studied_today).toBe(false);
  });
  it("breaks after a missed day but remembers the best run", () => {
    const s = computeStreak(["2026-11-21", "2026-11-18", "2026-11-17", "2026-11-16", "2026-11-15"], "2026-11-21");
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
    expect(s.total_days).toBe(5);
  });
  it("is zero with no days, or when the last day was two days ago", () => {
    expect(computeStreak([], "2026-11-21").current).toBe(0);
    expect(computeStreak(["2026-11-19"], "2026-11-21").current).toBe(0);
  });
  it("works across a month boundary and ignores duplicates", () => {
    expect(computeStreak(["2026-12-01", "2026-12-01", "2026-11-30", "2026-11-29"], "2026-12-01").current).toBe(3);
  });
});

describe("milestones and dates", () => {
  it("reports the milestones a best streak reached", () => {
    expect(reachedStreakMilestones(2)).toEqual([]);
    expect(reachedStreakMilestones(8)).toEqual(["streak_3", "streak_7"]);
    expect(reachedStreakMilestones(30)).toEqual(["streak_3", "streak_7", "streak_14", "streak_30"]);
  });
  it("gives today in the student's time zone", () => {
    const now = new Date("2026-11-22T01:30:00Z");
    expect(todayIn("America/Sao_Paulo", now)).toBe("2026-11-21");
    expect(todayIn("Asia/Tokyo", now)).toBe("2026-11-22");
    expect(todayIn("Not/AZone", now)).toBe("2026-11-21");
  });
});

describe("guided paths", () => {
  it("has the three paths with numbered days and a passage and goal each", () => {
    expect(PATHS.map((p) => [p.id, p.days.length])).toEqual([["at30", 30], ["paulo14", 14], ["parabolas14", 14]]);
    for (const p of PATHS) p.days.forEach((d, i) => { expect(d.day).toBe(i + 1); expect(d.goal.length).toBeGreaterThan(15); expect(/^[0-9A-Z]{3}\.\d+\.\d+-[0-9A-Z]{3}\.\d+\.\d+$/.test(d.ref), `${p.id}/${d.day}`).toBe(true); });
    expect(getPath("nope")).toBeUndefined();
  });
  it("the teacher layer leads one day and does not run ahead", () => {
    const l = layerTrail({ trail: { path: "Panorama", day: 3, total: 30, title: "Abraão: a promessa", ref: "GEN.12.1-GEN.15.6", goal: "Ver a promessa." } });
    expect(l).toContain("dia 3 de 30");
    expect(l).toContain("GEN.12.1-GEN.15.6");
    expect(l).toContain("Não adiante os próximos dias");
    expect(layerTrail({})).toBe("");
  });
});

import { fitFont, wrapLines } from "@/lib/share/card";
describe("share card text layout", () => {
  const measure = (s: string) => s.length * 10; // 10 px per character
  it("wraps words into lines that fit", () => {
    expect(wrapLines("um dois tres quatro cinco", 90, measure)).toEqual(["um dois", "tres", "quatro", "cinco"]);
    expect(wrapLines("", 90, measure)).toEqual([]);
  });
  it("keeps a word longer than the width on its own line instead of looping", () => {
    expect(wrapLines("supercalifragilistico ok", 50, measure)).toEqual(["supercalifragilistico", "ok"]);
  });
  it("picks the largest font that fits and shrinks for long texts", () => {
    const m = (size: number, s: string) => s.length * size * 0.5;
    const short = fitFont("Deus é amor", 900, 600, m);
    const long = fitFont("palavra ".repeat(120), 900, 600, m);
    expect(short.size).toBe(64);
    expect(long.size).toBeLessThan(64);
  });
  it("cuts a text that cannot fit even at the smallest size, with an ellipsis", () => {
    const m = (size: number, s: string) => s.length * size * 0.5;
    const r = fitFont("palavra ".repeat(600), 900, 300, m);
    expect(r.size).toBe(28);
    expect(r.lines[r.lines.length - 1].endsWith("…")).toBe(true);
  });
});
