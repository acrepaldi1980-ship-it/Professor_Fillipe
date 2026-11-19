// Text-to-speech with Gemini (Google): the same family of voices as the teacher's greeting video (D-04, chosen by the owner
// on 19/11/2026). One call per sentence; returns a WAV clip. Needs GEMINI_API_KEY with billing credit (else HTTP 402,
// and the app falls back to the device voice).
import { pcmToWav } from "../wav";
import type { VoiceProvider } from "../types";

export class GeminiTtsProvider implements VoiceProvider {
  readonly name = "gemini";
  readonly audioType = "audio/wav";

  async synthesize(text: string, opts: { voiceId?: string } = {}): Promise<ArrayBuffer> {
    const model = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
    const voice = opts.voiceId ?? process.env.GEMINI_VOICE ?? "Charon";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "proxy-injected" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Diga em português do Brasil, com voz calorosa, calma e acolhedora de um professor: ${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    if (!res.ok) throw new Error(`tts_failed_${res.status}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data) throw new Error("tts_empty");
    const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1]) || 24000;
    return pcmToWav(new Uint8Array(Buffer.from(part.data, "base64")), rate);
  }
}
