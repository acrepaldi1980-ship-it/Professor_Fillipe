// POST /api/v1/teacher/turn (spec 10.5): one teacher turn, answered as Server-Sent Events.
// Requires login. Events: `structured` (the validated contract), `done` (metrics), `error`.
// Persistence: the conversation is saved in `messages`; for a pastoral crisis NO text is stored, only the event (spec 8.5.8).
import { z } from "zod";
import { clientKey, enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { studentForPrompt } from "@/lib/auth/profile";
import { loadBibleSettings } from "@/lib/auth/preferences";
import { createTurnDeps, teacherProvider } from "@/lib/teacher/deps";
import { runTurn } from "@/lib/teacher/pipeline";
import { INTENTS } from "@/lib/teacher/schema";
import { findReferences } from "@/lib/knowledge/refs-parser";
import { track } from "@/lib/analytics/track";
import { loadAccess, loadUsage } from "@/lib/entitlements/server";
import { checkLimit, overFairUse } from "@/lib/entitlements";
import { buildSection } from "@/lib/modes/build";
import { appendNote, detectEdit } from "@/lib/modes/edit-intent";
import { addUsage, costBrl } from "@/lib/entitlements/guard";
import { getPackage, getTour } from "@/lib/immersive/registry";
import { sceneContext } from "@/lib/immersive/guide";
import { panoContext } from "@/lib/immersive/pano";
import { applyModePayload, deepSources, loadSessionMode, sermonTypeDefinition } from "@/lib/modes/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  intent: z.enum(INTENTS).optional(),
  /** Immersive environment (Prompt 3.3): only where the visitor is; the teacher's knowledge of the place comes from the package on the server. */
  scene: z.object({ env: z.string().max(40), x: z.number().finite(), z: z.number().finite(), yaw: z.number().finite(), hotspot: z.string().max(40).nullish(), station: z.number().int().min(0).max(30).nullish() }).optional(),
  /** 360° photo tour (Prompt 3.5b): which scene, which pin and where the student looks; the knowledge of the place comes from the registered tour. */
  pano: z.object({ tour: z.string().max(40), scene: z.string().max(40), hotspot: z.string().max(40).nullish(), yaw: z.number().finite().optional(), pitch: z.number().finite().optional() }).optional(),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireUser(req);
    await enforceRate(ctx.db, `u:${ctx.user.id}:turn`, LIMITS.turn);
    await enforceRate(ctx.db, clientKey(req) + ":turn", { limit: 60, windowSeconds: 60 });
  } catch (e) {
    return errorResponse(e);
  }
  const { user, db } = ctx;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (teacherProvider() === "anthropic" && !process.env.ANTHROPIC_API_KEY) return Response.json({ error: "teacher_unavailable" }, { status: 503 });

  // The session must belong to the user (Row Level Security hides other people's sessions).
  const { data: session } = await db.from("sessions").select("id").eq("id", parsed.data.sessionId).maybeSingle();
  if (!session) return errorResponse(new HttpError(404, "session_not_found"));

  // Plan limits (spec 8.12): text messages per day by plan; paid plans have fair use (moved to the fast model far above normal use).
  let fairUse = false;
  try {
    const [access, usage] = await Promise.all([loadAccess(db, user.id), loadUsage(db, user.id)]);
    const safety = Number(process.env.TEACHER_DAILY_LIMIT) || 400; // absolute guard against runaway spending, whatever the plan
    if (usage.text_messages_day >= safety) return Response.json({ error: "daily_limit" }, { status: 429 });
    const lim = checkLimit(access, usage, "text_messages_day");
    if (!lim.ok) return Response.json({ error: "limit", kind: "text_messages_day", limit: lim.limit, used: lim.used, plan: access.plan, upgrade: "plus" }, { status: 429 });
    fairUse = overFairUse(access, usage.text_messages_day);
  } catch {
    /* if the plan cannot be read the turn goes on (Free limits are then enforced by the next call) */
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const [student, bible] = await Promise.all([studentForPrompt(db, user.id), loadBibleSettings(db, user.id)]);
        // Conversation context comes from the database, so it survives serverless instances (the in-memory copy does not).
        const { data: recent } = await db.from("messages").select("role,text,speech,structured").eq("session_id", session.id).order("created_at", { ascending: false }).limit(8);
        const ordered = (recent ?? []).reverse();
        const history = ordered.map((m) => ({ role: (m.role === "teacher" ? "assistant" : "user") as "assistant" | "user", content: m.speech || m.text }));
        const lastTeacher = [...ordered].reverse().find((m) => m.role === "teacher");
        const structured = lastTeacher?.structured as { citations?: { type: string; ref?: string }[]; speech?: string; display_markdown?: string } | null | undefined;
        const lastRefs = [
          ...(structured?.citations ?? []).filter((c) => c.type === "bible" && c.ref).map((c) => c.ref as string),
          ...findReferences(`${structured?.speech ?? ""} ${structured?.display_markdown ?? ""}`, { strictCase: true }).flatMap((r) => r.refs),
        ].slice(0, 10);
        // Guided modes: the session carries its setup (age group, sermon type, passage...) and the live document is updated from mode_payload.
        const sm = await loadSessionMode(db, session.id);
        const mode = sm?.mode ?? "free";
        const [typeDef, extraSources] = await Promise.all([mode === "sermon" ? sermonTypeDefinition(db, sm?.context.sermon_type) : undefined, mode === "deep" ? deepSources(sm?.context.ref) : undefined]);
        // Inside an immersive environment the teacher knows where the student is and what they see (from the package, never from client text).
        const pkg = parsed.data.scene ? getPackage(parsed.data.scene.env) : undefined;
        const tour = parsed.data.pano ? getTour(parsed.data.pano.tour) : undefined;
        const scene = pkg && parsed.data.scene ? sceneContext(pkg, parsed.data.scene) : tour && parsed.data.pano ? panoContext(tour, parsed.data.pano) : null;
        const { response: baseResponse, meta } = await runTurn({ ...parsed.data, student, bible, history, lastRefs: scene ? [...scene.refs, ...lastRefs].slice(0, 12) : lastRefs, mode, modeContext: sm?.context, sermonTypeDefinition: typeDef, extraSources: [extraSources, scene?.text].filter(Boolean).join("\n\n") || undefined, forceFast: fairUse }, createTurnDeps());

        // After the document was delivered, a change request in the conversation ("refaça a introdução") rewrites that section for real.
        let response = baseResponse;
        if (sm && (sm.mode === "lesson" || sm.mode === "sermon" || sm.mode === "deep") && !response.pastoral_flag) {
          const divisions = sm.mode === "sermon" ? (((await db.from("sermon_outlines").select("data").eq("session_id", sm.id).maybeSingle()).data?.data as { divisions?: unknown[] } | undefined)?.divisions?.length ?? 0) : 0;
          const intent = detectEdit(parsed.data.text, sm.mode, divisions);
          if (intent) {
            let note: string;
            try {
              await buildSection(db, user.id, sm, intent.section, intent.instruction);
              note = ` Já atualizei ${intent.label} no documento.`;
            } catch {
              note = " Não consegui atualizar o documento agora; tente de novo ou edite você mesmo.";
            }
            // if the chat answer itself failed (model limit) but the document was changed, say only what is true
            response = meta.degraded && note.startsWith(" Já")
              ? { ...response, speech: `${student.preferred_name}, ajustei ${intent.label} no documento. Ficou como você queria?`, next_options: [{ label: "Ficou bom", intent: "next" }, { label: "Quero mudar mais", intent: "ask" }] }
              : { ...response, speech: appendNote(response.speech, note) };
          }
        }

        // The answer goes out NOW; saving it, the usage meter and the analytics happen after (the student must not wait for the database to start hearing it).
        controller.enqueue(enc.encode(sse("structured", response)));

        let messageId: string | undefined;
        if (response.pastoral_flag) {
          await db.from("pastoral_events").insert({ user_id: user.id });
        } else {
          const rows = [
            { session_id: session.id, role: "user", text: parsed.data.text },
            { session_id: session.id, role: "teacher", text: response.display_markdown || response.speech, speech: response.speech, structured: response, latency_ms: meta.latencyMs },
          ];
          const { data: saved } = await db.from("messages").insert(rows).select("id,role");
          messageId = saved?.find((m) => m.role === "teacher")?.id;
          if (sm) await applyModePayload(db, user.id, sm, response, parsed.data.text).catch(() => null);
        }

        // Usage meter: one text message, a deep call when the tier was deep, and the estimated cost in BRL.
        void addUsage(db, "text_messages", 1);
        if (meta.tier === "deep") void addUsage(db, "deep_calls", 1);
        void addUsage(db, "cost_brl", costBrl(meta.llm));
        track(db, "turn_completed", { latency_ms: meta.latencyMs, tier: meta.tier, cost_brl: costBrl(meta.llm), degraded: !!meta.degraded });
        // Audit by sampling (spec 8.14): about 1% of the answers go to the reviewers, whatever the student thought of them.
        if (messageId && Math.random() < (Number(process.env.AUDIT_SAMPLE_RATE) || 0.01)) void db.from("answer_flags").insert({ message_id: messageId, user_id: user.id, reason: "audit_sample" });
        // Never log the student's text (spec 13): only metrics.
        console.log(JSON.stringify({ evt: "turn", ...meta }));
        controller.enqueue(enc.encode(sse("done", { ...meta, messageId, fairUse })));
      } catch (e) {
        console.error(JSON.stringify({ evt: "turn_error", code: (e as Error).message.slice(0, 80) }));
        controller.enqueue(enc.encode(sse("error", { code: "turn_failed", detail: (e as Error).message.slice(0, 160) })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
