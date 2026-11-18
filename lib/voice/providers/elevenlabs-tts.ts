// Text-to-speech via ElevenLabs (D-03: voice "George"). One call per sentence, returns mp3.
import type { VoiceProvider } from "../types";

export class ElevenLabsTtsProvider implements VoiceProvider {
  readonly name = "elevenlabs";

  async synthesize(text: string, opts: { voiceId?: string } = {}): Promise<ArrayBuffer> {
    const voice = opts.voiceId ?? process.env.VOICE_ID_TEACHER ?? "JBFqnCBsd6RMkjVDRZzb";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": process.env.VOICE_API_KEY ?? "proxy-injected" },
      body: JSON.stringify({ text, model_id: process.env.TTS_MODEL ?? "eleven_multilingual_v2", language_code: "pt" }),
    });
    if (!res.ok) throw new Error(`tts_failed_${res.status}`);
    return res.arrayBuffer();
  }
}
