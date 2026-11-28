// POST /api/v1/voice/transcribe: multipart `audio` -> { text, confidence }. Audio is never stored (RF-M02-03).
// Login required and rate limited: every call spends the speech-recognition quota.
import { errorResponse, requireUser } from "@/lib/auth/server";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { recognitionVocabulary } from "@/lib/voice/speech-text";
import { stt } from "@/lib/voice";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const { db, user } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:stt`, LIMITS.voice);
  } catch (e) {
    return errorResponse(e);
  }
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "invalid_audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "audio_too_large" }, { status: 413 });
  try {
    const asked = String(form?.get("lang") ?? "");
    const language = (["pt", "en", "es", "it"] as const).find((l) => l === asked) ?? "pt";
    const out = await stt().transcribe!(audio, { language, vocabulary: language === "pt" ? recognitionVocabulary() : undefined });
    return Response.json(out);
  } catch {
    return Response.json({ error: "stt_unavailable" }, { status: 502 });
  }
}
