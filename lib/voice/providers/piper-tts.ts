// Free, offline male voice: Piper "faber" (pt_BR, CC0 dataset) run with sherpa-onnx inside the API function.
// No key and no per-use cost; the model lives in models/piper (fetched by scripts/fetch-piper.mjs, shipped with the deploy).
// Quality is plainer than Gemini/ElevenLabs, so it is the last resort of ttsChain (or the first with VOICE_PROVIDER=piper).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pauseAfter, polishSpeech } from "../polish";
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

interface Tts { generate(a: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number } }
let engine: Tts | null = null;

export const piperDir = () => process.env.PIPER_DIR ?? join(process.cwd(), "models", "piper");
export const piperAvailable = () => existsSync(join(piperDir(), "pt_BR-faber-medium.onnx"));

async function load(): Promise<Tts> {
  if (engine) return engine;
  // external package (see serverExternalPackages): resolved at run time, not bundled
  const mod = (await import("sherpa-onnx-node")) as unknown as { default?: { OfflineTts: new (c: unknown) => Tts }; OfflineTts?: new (c: unknown) => Tts };
  const sherpa = (mod.default ?? mod) as { OfflineTts: new (c: unknown) => Tts };
  const d = piperDir();
  engine = new sherpa.OfflineTts({
    model: { vits: { model: join(d, "pt_BR-faber-medium.onnx"), tokens: join(d, "tokens.txt"), dataDir: join(d, "espeak-ng-data") }, numThreads: 2, provider: "cpu" },
    maxNumSentences: 1,
  });
  return engine;
}

export class PiperTtsProvider implements VoiceProvider {
  readonly name = "piper";
  readonly audioType = "audio/wav";

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!piperAvailable()) throw new Error("piper_model_missing");
    const a = (await load()).generate({ text, sid: 0, speed: 0.95 });
    const x = polishSpeech(a.samples, a.sampleRate, { tail: pauseAfter(text) });
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
    return pcmToWav(new Uint8Array(pcm.buffer), a.sampleRate);
  }
}
