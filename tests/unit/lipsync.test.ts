import { describe, expect, it } from "vitest";
import { FACE_MOUTH, stepMotion, taper } from "../../lib/avatar/lipsync";

describe("natural mouth", () => {
  it("the jaw drop is largest in the middle of the mouth and zero at the corners", () => {
    expect(taper(FACE_MOUTH, FACE_MOUTH.cx)).toBeCloseTo(1, 5);
    expect(taper(FACE_MOUTH, FACE_MOUTH.cx + FACE_MOUTH.halfW)).toBe(0);
    expect(taper(FACE_MOUTH, FACE_MOUTH.cx - FACE_MOUTH.halfW - 10)).toBe(0);
    expect(taper(FACE_MOUTH, FACE_MOUTH.cx + 20)).toBeLessThan(1);
    expect(taper(FACE_MOUTH, FACE_MOUTH.cx + 20)).toBeGreaterThan(taper(FACE_MOUTH, FACE_MOUTH.cx + 50));
  });
  it("opens quickly and closes more slowly, without jumps", () => {
    let s = { drop: 0, nod: 0 };
    s = stepMotion(s, 0.3, true, 0);
    const opened = s.drop;
    expect(opened).toBeGreaterThan(0.3);
    expect(opened).toBeLessThan(1);
    let c = { drop: 1, nod: 0 };
    c = stepMotion(c, 0, true, 0);
    expect(1 - c.drop).toBeLessThan(opened); // closing step is smaller than the opening step
  });
  it("closes completely and stops nodding when the speech ends", () => {
    let s = { drop: 0.9, nod: 0.6 };
    for (let i = 0; i < 60; i++) s = stepMotion(s, 0.5, false, i * 16);
    expect(s.drop).toBeLessThan(0.01);
    expect(Math.abs(s.nod)).toBeLessThan(0.05);
  });
  it("the nod stays tiny while speaking", () => {
    let s = { drop: 0, nod: 0 };
    let max = 0;
    for (let i = 0; i < 400; i++) { s = stepMotion(s, 0.4, true, i * 16); max = Math.max(max, Math.abs(s.nod)); }
    expect(max).toBeLessThan(1.2);
  });
});

import { jawTaper } from "../../lib/avatar/lipsync";
describe("jaw", () => {
  it("is wider than the mouth, full under the middle and zero at the edge of the beard", () => {
    expect(FACE_MOUTH.jawHalfW).toBeGreaterThan(FACE_MOUTH.halfW);
    expect(jawTaper(FACE_MOUTH, FACE_MOUTH.cx)).toBeCloseTo(1, 5);
    expect(jawTaper(FACE_MOUTH, FACE_MOUTH.cx + FACE_MOUTH.jawHalfW)).toBe(0);
  });
  it("opens enough to be seen but not too much (24 to 32 px of an 800 px face) and stays above the neck", () => {
    expect(FACE_MOUTH.maxDrop).toBeGreaterThanOrEqual(24);
    expect(FACE_MOUTH.maxDrop).toBeLessThanOrEqual(32);
    expect(FACE_MOUTH.lipY + FACE_MOUTH.jawH + FACE_MOUTH.maxDrop).toBeLessThan(660);
  });
});
