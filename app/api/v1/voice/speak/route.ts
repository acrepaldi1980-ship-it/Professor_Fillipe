// POST /api/v1/voice/speak { text } -> audio/mpeg for ONE sentence (the client calls it sentence by sentence).
import { z } from "zod";
import { prepareForSpeech } from "@/lib/voice/speech-text";
import { tts } from "@/lib/voice";

export const runtime = "nodejs";
const body = z.object({ text: z.string().min(1).max(600), voiceId: z.string().optional() });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    const audio = await tts().synthesize!(prepareForSpeech(parsed.data.text), { voiceId: parsed.data.voiceId });
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "tts_unavailable" }, { status: 502 });
  }
}
