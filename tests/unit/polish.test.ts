import { describe, expect, it } from "vitest";
import { pauseAfter, polishSpeech } from "@/lib/voice/polish";

const tone = (hz: number, sec: number, amp: number, sr = 24000) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));
const rms = (x: Float32Array) => Math.sqrt(x.reduce((t, v) => t + v * v, 0) / x.length);

describe("speech polish", () => {
  it("keeps samples finite and under full scale, and adds the tail of silence", () => {
    const y = polishSpeech(tone(180, 1, 0.9), 24000, { tail: 0.3 });
    expect(y.length).toBe(24000 + 7200);
    expect(y.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.9)).toBe(true);
    expect(rms(y.subarray(24000))).toBe(0);
  });
  it("evens out the level: a quiet and a loud voice end up close together", () => {
    const quiet = rms(polishSpeech(tone(200, 1.5, 0.06), 24000).subarray(12000, 30000));
    const loud = rms(polishSpeech(tone(200, 1.5, 0.8), 24000).subarray(12000, 30000));
    expect(loud / quiet).toBeLessThan(3);
  });
  it("removes low rumble and softens hiss", () => {
    const rumble = rms(polishSpeech(tone(25, 1, 0.5), 24000)) / 0.35;
    const body = rms(polishSpeech(tone(200, 1, 0.5), 24000)) / 0.35;
    expect(rumble).toBeLessThan(body);
  });
  it("starts and ends without clicks", () => {
    const y = polishSpeech(tone(300, 0.5, 0.8), 24000);
    expect(Math.abs(y[0])).toBeLessThan(0.01);
  });
  it("empty input stays empty", () => expect(polishSpeech(new Float32Array(0), 24000).length).toBe(0));
  it("breathes longer after a question or a full stop than after a comma", () => {
    expect(pauseAfter("Entendeu?")).toBeGreaterThan(pauseAfter("Entendeu."));
    expect(pauseAfter("Entendeu.")).toBeGreaterThan(pauseAfter("Veja, "));
  });
});
