import { describe, expect, it } from "vitest";
import { stepMotion, type Motion } from "@/lib/avatar/lipsync";

function run(levelAt: (i: number) => number, frames = 600): Motion[] {
  let s: Motion = { drop: 0, nod: 0, bob: 0, act: 0 };
  const out: Motion[] = [];
  for (let i = 0; i < frames; i++) { s = stepMotion(s, levelAt(i), true, i * 16.7); out.push(s); }
  return out;
}

describe("the head is calm while the jaw follows the speech", () => {
  it("syllable-rate level changes (every frame, 0 and 0.3) never move the head more than a hair per frame", () => {
    const m = run((i) => (i % 2 ? 0.3 : 0));
    const maxStepNod = Math.max(...m.slice(1).map((x, i) => Math.abs(x.nod - m[i].nod)));
    const maxStepBob = Math.max(...m.slice(1).map((x, i) => Math.abs(x.bob - m[i].bob)));
    expect(maxStepNod).toBeLessThan(0.03); // degrees per frame
    expect(maxStepBob).toBeLessThan(0.03); // px per frame
  });
  it("the head does not depend on the level at all: loud and silent speech move it the same way", () => {
    const a = run(() => 0), b = run(() => 0.3);
    for (let i = 0; i < a.length; i++) { expect(a[i].nod).toBeCloseTo(b[i].nod, 6); expect(a[i].bob).toBeCloseTo(b[i].bob, 6); }
  });
  it("stays small: under 0.6 degrees and 0.6 px", () => {
    const m = run((i) => Math.abs(Math.sin(i / 5)) * 0.3, 1200);
    expect(Math.max(...m.map((x) => Math.abs(x.nod)))).toBeLessThan(0.6);
    expect(Math.max(...m.map((x) => Math.abs(x.bob)))).toBeLessThan(0.6);
  });
  it("the jaw still follows the level (fast to open, slower to close)", () => {
    let s: Motion = { drop: 0, nod: 0, bob: 0, act: 0 };
    s = stepMotion(s, 0.3, true, 0); const open = s.drop;
    s = stepMotion(s, 0, true, 16); const closing = s.drop;
    expect(open).toBeGreaterThan(0.5); expect(closing).toBeLessThan(open); expect(closing).toBeGreaterThan(0.2);
  });
});
