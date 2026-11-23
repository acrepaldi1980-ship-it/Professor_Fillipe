// POST /api/v1/voice/speak { text } -> audio for ONE sentence (the client calls it sentence by sentence).
// Login required (it spends money per call); a small in-memory cache avoids paying twice for repeated sentences.
import { createHash } from "node:crypto";
import { z } from "zod";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { errorResponse, requireUser } from "@/lib/auth/server";
import { addUsage, enforceLimit } from "@/lib/entitlements/guard";
import { logEvent } from "@/lib/telemetry/log";
import { ttsChain } from "@/lib/voice";
import { prepareForSpeech } from "@/lib/voice/speech-text";

export const runtime = "nodejs";
export const maxDuration = 30;
const body = z.object({ text: z.string().min(1).max(450), voiceId: z.string().optional(), /** Only loads the voice (the first call after a pause is slow): nothing is returned or counted. */ warm: z.boolean().optional() });

const cache = new Map<string, ArrayBuffer>();
const MAX_CACHE = 60;

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireUser(req);
    await enforceRate(ctx.db, `u:${ctx.user.id}:voice`, LIMITS.voice);
    await enforceLimit(ctx.db, ctx.user.id, "voice_minutes_day");
  } catch (e) {
    return errorResponse(e);
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const spoken = prepareForSpeech(parsed.data.text);
  if (parsed.data.warm) {
    for (const provider of ttsChain()) { try { await provider.synthesize!("Olá, tudo bem?"); break; } catch { /* try the next one */ } }
    return new Response(null, { status: 204 });
  }
  // Providers in order; the first that answers wins. The cache is keyed by text and voice, so a repeated sentence costs nothing.
  for (const provider of ttsChain()) {
    const key = createHash("sha1").update(`${provider.name}|${parsed.data.voiceId ?? ""}|${spoken}`).digest("hex");
    try {
      let audio = cache.get(key);
      if (!audio) {
        audio = await provider.synthesize!(spoken, { voiceId: parsed.data.voiceId });
        cache.set(key, audio);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
      }
      void addUsage(ctx.db, "voice_seconds", Math.max(1, Math.round(spoken.length / 14))); // ~14 characters per second of speech
      return new Response(audio, { headers: { "Content-Type": provider.audioType ?? "audio/mpeg", "Cache-Control": "private, no-store" } });
    } catch (e) {
      logEvent("tts_provider_failed", { provider: provider.name, code: String((e as Error).message).slice(0, 120) });
    }
  }
  return Response.json({ error: "tts_unavailable" }, { status: 502 });
}
