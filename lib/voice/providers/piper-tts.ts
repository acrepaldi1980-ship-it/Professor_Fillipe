// Free, offline male voice: Piper (pt_BR, CC0 datasets) run with sherpa-onnx inside the API function. No key and no per-use cost; the models live in
// models/piper (fetched by scripts/fetch-piper.mjs, shipped with the deploy).
// DEFAULT = "faber", the first voice the app ever used (owner's choice, 23/11/2026), spoken exactly as the model comes: no finishing filter, no pitch or pace change,
// no pronunciation rules. PIPER_VOICE=cadu selects the tuned "announcer" variant (calmer pace, phrase pauses, finishing, pronunciation rules) kept for later use.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pauseAfter, polishSpeech, resample, splitPhrases } from "../polish";
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

interface Tts { generate(a: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number } }
let engine: Tts | null = null;

const baseDir = () => process.env.PIPER_DIR ?? join(process.cwd(), "models", "piper");
/** Voice file name (PIPER_VOICE=faber selects the older, higher-pitched voice). */
const voice = () => process.env.PIPER_VOICE ?? "faber";
/** The first voice, untouched. */
const original = () => voice() === "faber";
const onnx = () => `pt_BR-${voice()}-medium.onnx`;
/** cadu has its own folder (its tokens differ from faber's); faber lives at the root of models/piper. */
export const piperDir = () => (voice() === "faber" ? baseDir() : join(baseDir(), voice()));
export const piperAvailable = () => existsSync(join(piperDir(), onnx()));
/** Announcer settings: a touch more pitch variation than the default (0.667/0.8) and a slow, unhurried pace (length scale 1.5, about 2.5 words per second; the first tunings (1.07, 1.2) were still too fast for the owner). */
/** Announcer voice: the voice is lowered by this ratio (0.92 = about 8% deeper and slower, the chest of a broadcast announcer). 1 turns it off. */
const DEEPEN = Number(process.env.PIPER_DEEPEN ?? 1);
const NOISE = Number(process.env.PIPER_NOISE ?? 0.55), NOISE_W = Number(process.env.PIPER_NOISE_W ?? 0.7), LENGTH = Number(process.env.PIPER_LENGTH ?? 1.5);

async function load(): Promise<Tts> {
  if (engine) return engine;
  // external package (see serverExternalPackages): resolved at run time, not bundled
  const mod = (await import("sherpa-onnx-node")) as unknown as { default?: { OfflineTts: new (c: unknown) => Tts }; OfflineTts?: new (c: unknown) => Tts };
  const sherpa = (mod.default ?? mod) as { OfflineTts: new (c: unknown) => Tts };
  const d = piperDir();
  engine = new sherpa.OfflineTts({
    model: { vits: { model: join(d, onnx()), tokens: join(d, "tokens.txt"), dataDir: join(d, "espeak-ng-data"), ...(original() ? {} : { noiseScale: NOISE, noiseScaleW: NOISE_W, lengthScale: LENGTH }) }, numThreads: 2, provider: "cpu" },
    maxNumSentences: 1,
  });
  return engine;
}

export class PiperTtsProvider implements VoiceProvider {
  readonly name = "piper";
  readonly audioType = "audio/wav";

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!piperAvailable()) throw new Error("piper_model_missing");
    const tts = await load();
    if (original()) {
      const o = tts.generate({ text, sid: 0, speed: 1.0 });
      const raw = new Int16Array(o.samples.length);
      for (let i = 0; i < o.samples.length; i++) raw[i] = Math.max(-1, Math.min(1, o.samples[i])) * 32767;
      return pcmToWav(new Uint8Array(raw.buffer), o.sampleRate);
    }
    // A breath at every comma, semicolon and colon: the phrases are spoken one by one and joined with a short silence (a calm, "compassed" cadence).
    const phrases = splitPhrases(text);
    const parts: Float32Array[] = [];
    let sr = 22050;
    phrases.forEach((ph, i) => {
      const a = tts.generate({ text: ph, sid: 0, speed: 1.0 });
      sr = a.sampleRate;
      parts.push(a.samples);
      if (i < phrases.length - 1) parts.push(new Float32Array(Math.round(sr * (/[;:]$/.test(ph) ? 0.3 : 0.2))));
    });
    const joined = new Float32Array(parts.reduce((t, p) => t + p.length, 0));
    let at = 0;
    for (const p of parts) { joined.set(p, at); at += p.length; }
    const a = { samples: resample(joined, DEEPEN), sampleRate: sr };
    const x = polishSpeech(a.samples, a.sampleRate, { tail: pauseAfter(text) });
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
    return pcmToWav(new Uint8Array(pcm.buffer), a.sampleRate);
  }
}
