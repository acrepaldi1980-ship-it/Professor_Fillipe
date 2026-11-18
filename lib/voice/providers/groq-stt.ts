// Speech-to-text via Groq (Whisper large-v3-turbo). The key comes from VOICE-side env (GROQ_API_KEY) or,
// in sandboxes, a proxy injects the real credential for a placeholder value.
import type { TranscribeResult, VoiceProvider } from "../types";

export class GroqSttProvider implements VoiceProvider {
  readonly name = "groq-whisper";

  async transcribe(audio: Blob, opts: { language?: string; vocabulary?: string[] } = {}): Promise<TranscribeResult> {
    const form = new FormData();
    form.set("file", audio, `audio.${audio.type.includes("mp4") ? "m4a" : "webm"}`);
    form.set("model", process.env.STT_MODEL ?? "whisper-large-v3-turbo");
    form.set("language", opts.language ?? "pt");
    form.set("response_format", "verbose_json");
    form.set("temperature", "0");
    if (opts.vocabulary?.length) form.set("prompt", `Estudo bíblico. Nomes e termos: ${opts.vocabulary.join(", ")}.`.slice(0, 800));
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY ?? "proxy-injected"}` },
      body: form,
    });
    if (!res.ok) throw new Error(`stt_failed_${res.status}`);
    const json = (await res.json()) as { text: string; segments?: { avg_logprob: number }[] };
    const lp = json.segments?.length ? json.segments.reduce((s, x) => s + x.avg_logprob, 0) / json.segments.length : undefined;
    return { text: json.text.trim(), confidence: lp === undefined ? undefined : Math.max(0, Math.min(1, Math.exp(lp))) };
  }
}
