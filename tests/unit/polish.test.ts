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

import { splitPhrases, trimLead } from "@/lib/voice/polish";
import { shortFirstChunk } from "@/lib/voice/speech-text";
describe("cadence and fast start", () => {
  it("cuts a sentence at commas into phrases of at least 3 words", () => {
    expect(splitPhrases("Antes de tudo, me conta o que você já sabe, tudo bem?")).toEqual(["Antes de tudo,", "me conta o que você já sabe, tudo bem?"]);
    expect(splitPhrases("Olá, Ana. Vamos")).toEqual(["Olá, Ana. Vamos"]);
    expect(splitPhrases("Sem vírgula nenhuma aqui")).toEqual(["Sem vírgula nenhuma aqui"]);
  });
  it("drops the silence before the first sound but keeps a little", () => {
    const x = new Float32Array(24000); for (let i = 12000; i < 24000; i++) x[i] = 0.3;
    const y = trimLead(x, 24000);
    expect(y.length).toBeLessThan(13000);
    expect(y.length).toBeGreaterThan(12000);
  });
  it("sends a long first sentence out in two so the voice starts sooner", () => {
    const long = "Hoje vamos olhar este texto de João, porque ele fala de um amor que a gente demora para entender.";
    const r = shortFirstChunk([long, "E você?"]);
    expect(r.length).toBe(3);
    expect(r[0].endsWith(",")).toBe(true);
    expect(r.join(" ")).toBe(`${long} E você?`);
    expect(shortFirstChunk(["Curta e direta.", "Outra."])).toEqual(["Curta e direta.", "Outra."]);
  });
});

import { readWav } from "@/lib/voice/providers/remote-tts";
import { resample } from "@/lib/voice/polish";
import { pcmToWav } from "@/lib/voice/wav";
describe("announcer voice and remote server", () => {
  it("lowering the voice by resampling makes it deeper and longer", () => {
    const x = Float32Array.from({ length: 24000 }, (_, i) => Math.sin((2 * Math.PI * 200 * i) / 24000));
    const y = resample(x, 0.92);
    expect(y.length).toBeGreaterThan(x.length * 1.07);
    let cross = 0; for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) cross++;
    expect(cross / (y.length / 24000)).toBeLessThan(195); // 200 Hz became about 184 Hz
  });
  it("reads back the WAV that the voice server sends", () => {
    const pcm = new Int16Array([0, 16384, -16384, 32767]);
    const { samples, sampleRate } = readWav(pcmToWav(new Uint8Array(pcm.buffer), 24000));
    expect(sampleRate).toBe(24000);
    expect(samples.length).toBe(4);
    expect(samples[1]).toBeCloseTo(0.5, 2);
  });
});
