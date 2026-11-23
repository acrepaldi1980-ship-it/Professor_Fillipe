// Free, offline, more natural male voice: Kokoro-82M (Apache-2.0), voice "pm_alex" (pt-BR), run with sherpa-onnx inside the API function.
// No key and no per-use cost; the model lives in models/kokoro (fetched by scripts/fetch-kokoro.mjs, shipped with the deploy).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { polishSpeech, pauseAfter } from "../polish";
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

interface Tts { generate(a: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number } }
let engine: Tts | null = null;

export const kokoroDir = () => process.env.KOKORO_DIR ?? join(process.cwd(), "models", "kokoro");
export const kokoroAvailable = () => existsSync(join(kokoroDir(), "model.int8.onnx"));
/** Speaker ids of the Kokoro v1.0 voice table: pm_alex 44 and pm_santa 45 are the Brazilian Portuguese men. */
const SPEAKER = Number(process.env.KOKORO_SPEAKER ?? 44);
const SPEED = Number(process.env.KOKORO_SPEED ?? 0.93); // a calm, unhurried teacher

async function load(): Promise<Tts> {
  if (engine) return engine;
  const mod = (await import("sherpa-onnx-node")) as unknown as { default?: { OfflineTts: new (c: unknown) => Tts }; OfflineTts?: new (c: unknown) => Tts };
  const sherpa = (mod.default ?? mod) as { OfflineTts: new (c: unknown) => Tts };
  const d = kokoroDir();
  engine = new sherpa.OfflineTts({
    model: { kokoro: { model: join(d, "model.int8.onnx"), voices: join(d, "voices.bin"), tokens: join(d, "tokens.txt"), dataDir: join(d, "espeak-ng-data"), lexicon: "", lang: "pt-br" }, numThreads: 2, provider: "cpu" },
    maxNumSentences: 1,
  });
  return engine;
}

export class KokoroTtsProvider implements VoiceProvider {
  readonly name = "kokoro";
  readonly audioType = "audio/wav";

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!kokoroAvailable()) throw new Error("kokoro_model_missing");
    const a = (await load()).generate({ text, sid: SPEAKER, speed: SPEED });
    const x = polishSpeech(a.samples, a.sampleRate, { tail: pauseAfter(text) });
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
    return pcmToWav(new Uint8Array(pcm.buffer), a.sampleRate);
  }
}
