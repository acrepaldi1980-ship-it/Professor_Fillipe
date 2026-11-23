// Free, offline, more natural male voice: Kokoro-82M (Apache-2.0), voice "pm_alex" (pt-BR), run with sherpa-onnx inside the API function.
// No key and no per-use cost; the model lives in models/kokoro (fetched by scripts/fetch-kokoro.mjs, shipped with the deploy).
import { closeSync, existsSync, openSync, readFileSync, renameSync, writeSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KOKORO_WHISTLE_HZ, NARRATOR_TONE, pauseAfter, polishSpeech, resample } from "../polish";
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

interface Tts { generate(a: { text: string; sid: number; speed: number }): { samples: Float32Array; sampleRate: number } }
let engine: Tts | null = null;

export const kokoroDir = () => process.env.KOKORO_DIR ?? join(process.cwd(), "models", "kokoro");
// A deployment file may not exceed 100 MB, so the model ships in parts (model.int8.onnx.part0, part1, ...) and is joined once into /tmp.
export const kokoroAvailable = () => existsSync(join(kokoroDir(), "model.int8.onnx")) || existsSync(join(kokoroDir(), "model.int8.onnx.part0"));
function modelPath(): string {
  const whole = join(kokoroDir(), "model.int8.onnx");
  if (existsSync(whole)) return whole;
  const dir = join(tmpdir(), "kokoro"), out = join(dir, "model.int8.onnx");
  if (existsSync(out)) return out;
  mkdirSync(dir, { recursive: true });
  const tmp = `${out}.${process.pid}.tmp`, fd = openSync(tmp, "w");
  for (let i = 0; existsSync(join(kokoroDir(), `model.int8.onnx.part${i}`)); i++) writeSync(fd, readFileSync(join(kokoroDir(), `model.int8.onnx.part${i}`)));
  closeSync(fd); renameSync(tmp, out);
  return out;
}
/** Speaker ids of the Kokoro v1.0 voice table: pm_alex 44 and pm_santa 45 are the Brazilian Portuguese men. */
const SPEAKER = Number(process.env.KOKORO_SPEAKER ?? 44);
const SPEED = Number(process.env.KOKORO_SPEED ?? 0.98); // a calm, unhurried teacher

async function load(): Promise<Tts> {
  if (engine) return engine;
  const mod = (await import("sherpa-onnx-node")) as unknown as { default?: { OfflineTts: new (c: unknown) => Tts }; OfflineTts?: new (c: unknown) => Tts };
  const sherpa = (mod.default ?? mod) as { OfflineTts: new (c: unknown) => Tts };
  const d = kokoroDir();
  engine = new sherpa.OfflineTts({
    model: { kokoro: { model: modelPath(), voices: join(d, "voices.bin"), tokens: join(d, "tokens.txt"), dataDir: join(d, "espeak-ng-data"), lexicon: "", lang: "pt-br" }, numThreads: 2, provider: "cpu" },
    maxNumSentences: 1,
  });
  return engine;
}

/** The voice is made younger by no resampling (a man of about 35: firm adult pitch, bright timbre, calm pace) (pitch and timbre rise, the pace quickens); the whistle frequencies move with it. KOKORO_DEEPEN: 1.08 younger, 1.13 younger still, 0.96 mature. */
const DEEPEN = Number(process.env.KOKORO_DEEPEN ?? 1);

export class KokoroTtsProvider implements VoiceProvider {
  readonly name = "kokoro";
  readonly audioType = "audio/wav";

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!kokoroAvailable()) throw new Error("kokoro_model_missing");
    const a = (await load()).generate({ text, sid: SPEAKER, speed: SPEED });
    const x = polishSpeech(resample(a.samples, DEEPEN), a.sampleRate, { tail: pauseAfter(text), tone: NARRATOR_TONE, rmsDb: -26, peak: 0.6, lowpassHz: 8800, notches: KOKORO_WHISTLE_HZ.map((f) => f * DEEPEN) });
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
    return pcmToWav(new Uint8Array(pcm.buffer), a.sampleRate);
  }
}
