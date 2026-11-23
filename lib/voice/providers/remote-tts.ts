// The narrator voice (Kokoro) served by a separate machine with more CPU than the app host (see voice-server/). The app adds the announcer finish.
// If the machine is slow or down (free hosts sleep), the call gives up after a few seconds and the chain falls back to the on-board Piper voice.
import { pauseAfter, polishSpeech, resample } from "../polish";
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

export const remoteConfigured = () => !!process.env.REMOTE_TTS_URL && !!process.env.REMOTE_TTS_TOKEN;

/** 16-bit mono PCM WAV -> float samples and sample rate. */
export function readWav(buf: ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const v = new DataView(buf);
  const sampleRate = v.getUint32(24, true);
  const n = Math.floor((buf.byteLength - 44) / 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = v.getInt16(44 + i * 2, true) / 32768;
  return { samples, sampleRate };
}

export class RemoteTtsProvider implements VoiceProvider {
  readonly name = "remote";
  readonly audioType = "audio/wav";

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!remoteConfigured()) throw new Error("remote_tts_not_configured");
    // REMOTE_TTS_PATH defaults to "/tts" (voice-server/server.mjs); on Modal the URL already is the endpoint, so the path is set to an empty value
    const res = await fetch(`${process.env.REMOTE_TTS_URL!.replace(/\/$/, "")}${process.env.REMOTE_TTS_PATH ?? "/tts"}`, {
      method: "POST",
      signal: AbortSignal.timeout(Number(process.env.REMOTE_TTS_TIMEOUT_MS ?? 7000)),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.REMOTE_TTS_TOKEN}` },
      body: JSON.stringify({ text, speaker: Number(process.env.KOKORO_SPEAKER ?? 44), speed: Number(process.env.KOKORO_SPEED ?? 0.9) }),
    });
    if (!res.ok) throw new Error(`remote_tts_${res.status}`);
    const { samples, sampleRate } = readWav(await res.arrayBuffer());
    const x = polishSpeech(resample(samples, Number(process.env.KOKORO_DEEPEN ?? 1)), sampleRate, { tail: pauseAfter(text), announcer: true });
    const pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
    return pcmToWav(new Uint8Array(pcm.buffer), sampleRate);
  }
}
