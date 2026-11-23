// Free, offline male voice: Piper "cadu" (pt_BR, CC0 dataset) run with sherpa-onnx inside the API function. Chosen because it is the closest to the
// narrator of the welcome video: median pitch 131 Hz (the video's), same warmth and brightness of timbre; tuned slower and more varied, like a calm announcer.
// No key and no per-use cost; the model lives in models/piper (fetched by scripts/fetch-piper.mjs, shipped with the deploy).
// Quality is plainer than Gemini/ElevenLabs, so it is the last resort of ttsChain (or the first with VOICE_PROVIDER=piper).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pauseAfter, polishSpeech, splitPhrases } from "../polish";
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

interface Tts { generate(a: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number } }
let engine: Tts | null = null;

const baseDir = () => process.env.PIPER_DIR ?? join(process.cwd(), "models", "piper");
/** Voice file name (PIPER_VOICE=faber selects the older, higher-pitched voice). */
const voice = () => process.env.PIPER_VOICE ?? "cadu";
const onnx = () => `pt_BR-${voice()}-medium.onnx`;
/** cadu has its own folder (its tokens differ from faber's); faber lives at the root of models/piper. */
export const piperDir = () => (voice() === "faber" ? baseDir() : join(baseDir(), voice()));
export const piperAvailable = () => existsSync(join(piperDir(), onnx()));
/** Announcer settings: a touch more pitch variation than the default (0.667/0.8) and a slow, unhurried pace (length scale 1.5, about 2.5 words per second; the first tunings (1.07, 1.2) were still too fast for the owner). */
const NOISE = Number(process.env.PIPER_NOISE ?? 0.8), NOISE_W = Number(process.env.PIPER_NOISE_W ?? 0.9), LENGTH = Number(process.env.PIPER_LENGTH ?? 1.5);

async function load(): Promise<Tts> {
  if (engine) return engine;
  // external package (see serverExternalPackages): resolved at run time, not bundled
  const mod = (await import("sherpa-onnx-node")) as unknown as { default?: { OfflineTts: new (c: unknown) => Tts }; OfflineTts?: new (c: unknown) => Tts };
  const sherpa = (mod.default ?? mod) as { OfflineTts: new (c: unknown) => Tts };
  const d = piperDir();
  engine = new sherpa.OfflineTts({
    model: { vits: { model: join(d, onnx()), tokens: join(d, "tokens.txt"), dataDir: join(d, "espeak-ng-data"), noiseScale: NOISE, noiseScaleW: NOISE_W, lengthScale: LENGTH }, numThreads: 2, provider: "cpu" },
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
    const a = { samples: joined, sampleRate: sr };
    const x = polishSpeech(a.samples, a.sampleRate, { tail: pauseAfter(text) });
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
    return pcmToWav(new Uint8Array(pcm.buffer), a.sampleRate);
  }
}
