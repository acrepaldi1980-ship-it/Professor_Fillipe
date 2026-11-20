import { describe, expect, it } from "vitest";
import { isDue, NEW_CARD, nextEase, schedule, type CardState } from "../../lib/review/sm2";

const DAY = 86_400_000;
const day0 = new Date("2026-11-21T10:00:00Z");

describe("SM-2 formulas of the specification", () => {
  it("ease changes by 0.1 - (5-q)(0.08 + (5-q)0.02), minimum 1.3", () => {
    expect(nextEase(2.5, 5)).toBe(2.6);
    expect(nextEase(2.5, 3)).toBe(2.36);
    expect(nextEase(2.5, 1)).toBe(1.96);
    expect(nextEase(1.4, 1)).toBe(1.3);
    expect(nextEase(1.3, 1)).toBe(1.3);
  });
  it("a new card starts with ease 2.5 and 1 day", () => {
    expect(NEW_CARD).toEqual({ ease: 2.5, interval_days: 1, repetitions: 0 });
  });
});

describe("intervals with a simulated clock", () => {
  it("right answers: 1 day, then 6 days, then previous interval x ease", () => {
    let c: CardState = { ...NEW_CARD };
    let now = day0;
    const dates: number[] = [];
    for (let i = 0; i < 4; i++) {
      const s = schedule(c, 5, now);
      dates.push(Math.round((s.due_at.getTime() - now.getTime()) / DAY));
      c = { ease: s.ease, interval_days: s.interval_days, repetitions: s.repetitions };
      now = s.due_at;
    }
    expect(dates.slice(0, 3)).toEqual([1, 6, 16]); // 6 x 2.7 = 16.2 -> 16
    expect(c.ease).toBeCloseTo(2.9, 5);
    expect(dates[3]).toBeGreaterThan(30);
  });
  it("a wrong answer sends the card back to 1 day and resets the repetitions", () => {
    const grown: CardState = { ease: 2.6, interval_days: 16, repetitions: 3 };
    const s = schedule(grown, 1, day0);
    expect(s.interval_days).toBe(1);
    expect(s.repetitions).toBe(0);
    expect(s.ease).toBe(2.06);
    expect(s.due_at.getTime() - day0.getTime()).toBe(DAY);
  });
  it("a partial answer keeps going but the ease falls", () => {
    const s = schedule({ ease: 2.5, interval_days: 6, repetitions: 2 }, 3, day0);
    expect(s.interval_days).toBe(15); // 6 x 2.5
    expect(s.ease).toBe(2.36);
  });
  it("cards reappear on the planned dates", () => {
    const s = schedule(NEW_CARD, 5, day0);
    expect(isDue(s.due_at, new Date(day0.getTime() + DAY - 1))).toBe(false);
    expect(isDue(s.due_at, new Date(day0.getTime() + DAY))).toBe(true);
  });
});
