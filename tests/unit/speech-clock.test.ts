import { describe, expect, it } from "vitest";
import { SpeechClock } from "../../lib/voice/clock";

describe("speech clock (mouth in time with the voice)", () => {
  it("runs at the planned speed until the engine says otherwise", () => {
    const c = new SpeechClock();
    c.start(1000);
    expect(c.planNow(1500)).toBe(500);
  });
  it("learns that the voice is slower and slows the mouth plan down", () => {
    const c = new SpeechClock();
    c.start(0);
    // the plan said word 2 starts at 1000 ms, but the engine reached it at 1500 ms: the voice is 1.5x slower
    for (let i = 1; i <= 6; i++) c.boundary(i * 1000, i * 1500);
    expect(c.speed).toBeGreaterThan(1.35);
    expect(c.speed).toBeLessThan(1.6);
    // 600 real ms after the last boundary the plan advanced only ~400 ms
    expect(c.planNow(6 * 1500 + 600) - 6000).toBeLessThan(470);
  });
  it("re-anchors on every boundary so there is no drift", () => {
    const c = new SpeechClock(0.5); // started with a wrong (too fast) guess
    c.start(0);
    c.boundary(2000, 2000);
    expect(c.planNow(2000)).toBe(2000);
    expect(c.boundaries).toBe(1);
  });
  it("ignores tiny gaps between boundaries and clamps absurd measurements", () => {
    const c = new SpeechClock();
    c.start(0);
    c.boundary(100, 5000); // 100 planned ms in 5 real seconds: not a speed measurement
    expect(c.speed).toBe(1);
    c.boundary(1100, 5000 + 100000);
    expect(c.speed).toBeLessThanOrEqual(1 + 0.35 * 1.2 + 1e-9);
  });
  it("a voice that matches the plan keeps the speed near 1", () => {
    const c = new SpeechClock();
    c.start(0);
    for (let i = 1; i <= 8; i++) c.boundary(i * 800, i * 800);
    expect(c.speed).toBeCloseTo(1, 2);
  });
});
