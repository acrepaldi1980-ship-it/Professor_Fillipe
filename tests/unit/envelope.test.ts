import { describe, expect, it } from "vitest";
import { computeEnvelope, levelAt } from "@/lib/voice/envelope";
import { audiblePlayhead } from "@/lib/voice/playhead";

const SR = 16000;
/** silence 300 ms, tone 400 ms, silence 300 ms */
function clip(amp = 0.5) {
  const a = new Float32Array(SR);
  for (let i = Math.floor(SR * 0.3); i < Math.floor(SR * 0.7); i++) a[i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR);
  return a;
}

describe("mouth envelope from the real audio", () => {
  it("is closed in the silence, open in the sound, and the edges land on the sound's edges (±30 ms)", () => {
    const e = computeEnvelope(clip(), SR);
    expect(levelAt(e, 100)).toBe(0);
    expect(levelAt(e, 900)).toBe(0);
    expect(levelAt(e, 500)).toBeGreaterThan(0.6);
    expect(levelAt(e, 270)).toBeLessThan(0.2); // 30 ms before the sound starts: still closed
    expect(levelAt(e, 330)).toBeGreaterThan(0.5); // 30 ms after: open
    expect(levelAt(e, 745)).toBeLessThan(levelAt(e, 500)); // closes after the sound
  });
  it("opens the same for a quiet voice and a loud one", () => {
    const quiet = levelAt(computeEnvelope(clip(0.05), SR), 500), loud = levelAt(computeEnvelope(clip(0.8), SR), 500);
    expect(Math.abs(quiet - loud)).toBeLessThan(0.15);
  });
  it("is 0 outside the clip", () => {
    const e = computeEnvelope(clip(), SR);
    expect(levelAt(e, -5)).toBe(0); expect(levelAt(e, 5000)).toBe(0);
  });
});

describe("audible playhead", () => {
  it("uses the output timestamp of the browser (already compensated for the speaker delay)", () => {
    const ctx = { currentTime: 10, getOutputTimestamp: () => ({ contextTime: 9.88, performanceTime: 1000 }) };
    expect(audiblePlayhead(ctx, 1000)).toBeCloseTo(9.88);
    expect(audiblePlayhead(ctx, 1100)).toBeCloseTo(9.98); // 100 ms later on the performance clock
  });
  it("falls back to currentTime minus the reported latencies", () => {
    expect(audiblePlayhead({ currentTime: 10, outputLatency: 0.12, baseLatency: 0.01 }, 0)).toBeCloseTo(9.87);
    expect(audiblePlayhead({ currentTime: 10 }, 0)).toBeCloseTo(9.99);
  });
});
