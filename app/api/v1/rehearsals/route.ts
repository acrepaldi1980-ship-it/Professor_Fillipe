// Ensaio do sermão (spec 8.7.5). One function for the whole feature (Vercel Hobby allows 12 functions per deployment):
//   GET    /api/v1/rehearsals?session_id=  -> rehearsals of the outline, newest first (no transcript)
//   GET    /api/v1/rehearsals?id=          -> one rehearsal with transcript (+ short-lived link to the kept audio, if any)
//   POST   /api/v1/rehearsals              -> multipart { audio, session_id, keep? }: transcribe, measure, analyze, save. The audio is deleted
//                                             after the analysis unless keep=1 (RF-M02-03).
//   DELETE /api/v1/rehearsals?id=          -> removes the rehearsal and its kept audio
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { loadConsents } from "@/lib/auth/profile";
import { requireFeature } from "@/lib/entitlements/guard";
import { completeJson } from "@/lib/llm/router";
import { buildPrompt, computeMetrics, ModelAnalysis, outlineParts, partTimes, type Segment } from "@/lib/rehearsal/analyze";
import { findReferences } from "@/lib/knowledge/refs-parser";
import { getVerses } from "@/lib/knowledge/search";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { stt } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 4_400_000; // Vercel functions accept bodies up to 4.5 MB
const uuid = z.string().uuid();

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      if (!uuid.safeParse(id).success) throw new HttpError(400, "invalid_request");
      const { data } = await db.from("rehearsals").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!data) throw new HttpError(404, "not_found");
      let audio_link: string | null = null;
      if (data.audio_url) audio_link = (await db.storage.from("rehearsals").createSignedUrl(data.audio_url, 3600)).data?.signedUrl ?? null;
      return Response.json({ ...data, audio_link });
    }
    const sid = url.searchParams.get("session_id");
    if (!sid || !uuid.safeParse(sid).success) throw new HttpError(400, "invalid_request");
    const { data } = await db.from("rehearsals").select("id, created_at, duration_s, metrics, feedback, audio_url").eq("session_id", sid).eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    return Response.json({ items: (data ?? []).map((r) => ({ ...r, audio_url: undefined, has_audio: !!r.audio_url })) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const { user, db } = await requireUser(req);
    // Read the upload first: answering a refusal before the body is consumed can cut the connection under the client's write.
    const form = await req.formData().catch(() => null);
    await requireFeature(db, user.id, "sermon");
    await enforceRate(db, `u:${user.id}:rehearsal`, LIMITS.rehearsal);
    const consents = await loadConsents(db, user.id);
    if (!consents.rehearsal_audio?.granted) throw new HttpError(403, "consent_required", { kind: "rehearsal_audio" });
    const audio = form?.get("audio");
    const sessionId = String(form?.get("session_id") ?? "");
    const keep = form?.get("keep") === "1";
    if (!(audio instanceof Blob) || audio.size < 2000 || !uuid.safeParse(sessionId).success) throw new HttpError(400, "invalid_request");
    if (audio.size > MAX_BYTES) throw new HttpError(413, "audio_too_large");

    const { data: outline } = await db.from("sermon_outlines").select("id, data").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!outline) throw new HttpError(404, "no_outline");
    const o = (outline.data ?? {}) as Record<string, unknown> & { base_text?: string; divisions?: { title: string }[] };
    const parts = outlineParts(o);
    if (!parts.length) throw new HttpError(422, "outline_empty");

    // 1) transcribe with timing. The audio lives only in this request's memory.
    const heard = await stt().transcribe!(audio, { language: "pt" }).catch(() => null);
    if (!heard?.segments?.length || heard.text.split(/\s+/).length < 30) throw new HttpError(422, "too_short_or_unclear");
    const segments: Segment[] = heard.segments;

    // 2) numbers
    const metrics = computeMetrics(segments, heard.text);

    // 3) judgement by the model, with the base text from the Bible (never from the model's memory)
    let passage = "";
    const refs = findReferences(String(o.base_text ?? "")).flatMap((r) => r.refs).slice(0, 3);
    if (refs.length) passage = (await getVerses("por_blivre_2018", refs).catch(() => [])).slice(0, 40).map((v) => `${v.ref} ${v.text}`).join("\n");
    const { system, user: prompt } = buildPrompt({ outline: o, parts, passage, segments, metrics });
    let feedback: unknown = null;
    let partTimesOut: ReturnType<typeof partTimes> = parts.map((p) => ({ ...p, seconds: null, words: null, found: false }));
    try {
      const r = await completeJson(system, prompt, { task: "json", maxTokens: 1800, temperature: 0.3, timeoutMs: 40000, validate: (x) => ModelAnalysis.safeParse(x).success });
      const parsed = ModelAnalysis.parse(r.out);
      feedback = parsed.feedback;
      partTimesOut = partTimes(parts, parsed.parts, segments);
    } catch { /* the numbers are still delivered; the written feedback can be asked again */ }

    // 4) save; keep the audio only when asked
    let audioPath: string | null = null;
    const { data: row, error } = await db.from("rehearsals").insert({ user_id: user.id, session_id: sessionId, outline_id: outline.id, transcript: heard.text, metrics: { ...metrics, parts: partTimesOut, planned_minutes: (o as { estimated_minutes?: number }).estimated_minutes ?? null }, feedback: feedback ?? {}, duration_s: metrics.total_seconds, analysis_ms: Date.now() - started }).select("id").single();
    if (error || !row) throw new HttpError(500, "save_failed");
    if (keep) {
      const ext = audio.type.includes("mp4") ? "m4a" : "webm";
      const path = `${user.id}/${row.id}.${ext}`;
      const up = await db.storage.from("rehearsals").upload(path, audio, { contentType: audio.type || "audio/webm" });
      if (!up.error) { audioPath = path; await db.from("rehearsals").update({ audio_url: path }).eq("id", row.id); }
    }
    return Response.json({ id: row.id, created_at: new Date().toISOString(), duration_s: metrics.total_seconds, metrics: { ...metrics, parts: partTimesOut }, feedback, transcript: heard.text, has_audio: !!audioPath, feedback_ok: !!feedback, analysis_ms: Date.now() - started }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!uuid.safeParse(id).success) throw new HttpError(400, "invalid_request");
    const { data } = await db.from("rehearsals").select("audio_url").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!data) throw new HttpError(404, "not_found");
    if (data.audio_url) await db.storage.from("rehearsals").remove([data.audio_url]);
    await db.from("rehearsals").delete().eq("id", id).eq("user_id", user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
