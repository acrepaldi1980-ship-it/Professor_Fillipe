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

describe("whistle and boom control", () => {
  const sr = 24000;
  const tone = (hz: number, amp: number) => Float32Array.from({ length: sr }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));
  const mix = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + b[i]);
  /** Energy at one frequency (Goertzel), in the middle of the clip. */
  const at = (x: Float32Array, hz: number) => {
    const seg = x.subarray(sr / 4, sr - sr / 4), w = (2 * Math.PI * hz) / sr, c = 2 * Math.cos(w);
    let s1 = 0, s2 = 0;
    for (const v of seg) { const s0 = v + c * s1 - s2; s2 = s1; s1 = s0; }
    return (s1 * s1 + s2 * s2 - c * s1 * s2) / seg.length;
  };
  const flat = { bass: 0, presence: 0, air: 0 };
  it("a notch removes a steady whistle from the voice without touching the voice range", () => {
    const sig = mix(tone(300, 0.3), tone(4800, 0.3));
    const before = at(polishSpeech(sig, sr, { tone: flat }), 4800) / at(polishSpeech(sig, sr, { tone: flat }), 300);
    const out = polishSpeech(sig, sr, { tone: flat, notches: [4800] });
    expect(at(out, 4800) / at(out, 300)).toBeLessThan(before * 0.05);
  });
  it("the low-pass silences what is above it and keeps the voice", () => {
    const sig = mix(tone(300, 0.3), tone(10500, 0.3));
    const before = at(polishSpeech(sig, sr, {}), 10500) / at(polishSpeech(sig, sr, {}), 300);
    const out = polishSpeech(sig, sr, { lowpassHz: 8800 });
    expect(at(out, 10500) / at(out, 300)).toBeLessThan(before * 0.05);
  });
  it("a lower peak setting makes a quieter voice", () => {
    const quiet = Math.max(...polishSpeech(tone(300, 0.3), sr, { peak: 0.5 }).map(Math.abs));
    const loud = Math.max(...polishSpeech(tone(300, 0.3), sr, {}).map(Math.abs));
    expect(quiet).toBeLessThan(loud * 0.7);
  });
});

import { isMaleVoice, isPremiumVoice } from "@/lib/platform/web/speech";
describe("premium device voices", () => {
  it("recognises the Edge neural voice Antonio and iOS enhanced male voices as premium", () => {
    expect(isPremiumVoice({ name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" })).toBe(true);
    expect(isMaleVoice({ name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)" })).toBe(true);
    expect(isPremiumVoice({ name: "Felipe (Enhanced)", lang: "pt-BR" })).toBe(true);
  });
  it("does not call a basic male voice, a female neural voice or another language premium", () => {
    expect(isPremiumVoice({ name: "Microsoft Daniel - Portuguese (Brazil)", lang: "pt-BR" })).toBe(false);
    expect(isPremiumVoice({ name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" })).toBe(false);
    expect(isPremiumVoice({ name: "Microsoft Alvaro Online (Natural) - Spanish (Spain)", lang: "es-ES" })).toBe(false);
  });
});
