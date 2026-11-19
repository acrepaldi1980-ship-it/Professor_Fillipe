// POST /api/v1/voice/speak { text } -> audio for ONE sentence (the client calls it sentence by sentence).
// Login required (it spends money per call); a small in-memory cache avoids paying twice for repeated sentences.
import { createHash } from "node:crypto";
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/auth/server";
import { tts } from "@/lib/voice";
import { prepareForSpeech } from "@/lib/voice/speech-text";

export const runtime = "nodejs";
export const maxDuration = 30;
const body = z.object({ text: z.string().min(1).max(450), voiceId: z.string().optional() });

const cache = new Map<string, ArrayBuffer>();
const MAX_CACHE = 60;

export async function POST(req: Request) {
  try {
    await requireUser(req);
  } catch (e) {
    return errorResponse(e);
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const provider = tts();
  const spoken = prepareForSpeech(parsed.data.text);
  const key = createHash("sha1").update(`${provider.name}|${parsed.data.voiceId ?? ""}|${spoken}`).digest("hex");
  try {
    let audio = cache.get(key);
    if (!audio) {
      audio = await provider.synthesize!(spoken, { voiceId: parsed.data.voiceId });
      cache.set(key, audio);
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
    }
    return new Response(audio, { headers: { "Content-Type": provider.audioType ?? "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "tts_unavailable" }, { status: 502 });
  }
}
