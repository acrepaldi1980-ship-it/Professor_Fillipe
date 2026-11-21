// POST /api/v1/voice/transcribe: multipart `audio` -> { text, confidence }. Audio is never stored (RF-M02-03).
import { recognitionVocabulary } from "@/lib/voice/speech-text";
import { stt } from "@/lib/voice";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "invalid_audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "audio_too_large" }, { status: 413 });
  try {
    const language = form?.get("lang") === "es" ? "es" : "pt";
    const out = await stt().transcribe!(audio, { language, vocabulary: language === "pt" ? recognitionVocabulary() : undefined });
    return Response.json(out);
  } catch {
    return Response.json({ error: "stt_unavailable" }, { status: 502 });
  }
}
