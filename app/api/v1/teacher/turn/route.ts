// POST /api/v1/teacher/turn (spec 10.5): one teacher turn, answered as Server-Sent Events.
// Requires login. Events: `structured` (the validated contract), `done` (metrics), `error`.
// Persistence: the conversation is saved in `messages`; for a pastoral crisis NO text is stored, only the event (spec 8.5.8).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { studentForPrompt } from "@/lib/auth/profile";
import { createTurnDeps, teacherProvider } from "@/lib/teacher/deps";
import { runTurn } from "@/lib/teacher/pipeline";
import { INTENTS } from "@/lib/teacher/schema";
import { findReferences } from "@/lib/knowledge/refs-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  text: z.string().min(1).max(2000),
  intent: z.enum(INTENTS).optional(),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireUser(req);
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

  // Spending guard: a daily cap of teacher answers per student (TEACHER_DAILY_LIMIT, default 40).
  const limit = Number(process.env.TEACHER_DAILY_LIMIT) || 40;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("role", "teacher").gte("created_at", dayStart.toISOString());
  if ((count ?? 0) >= limit * 1) return Response.json({ error: "daily_limit" }, { status: 429 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const student = await studentForPrompt(db, user.id);
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
        const { response, meta } = await runTurn({ ...parsed.data, student, history, lastRefs }, createTurnDeps());

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
        }

        // Never log the student's text (spec 13): only metrics.
        console.log(JSON.stringify({ evt: "turn", ...meta }));
        controller.enqueue(enc.encode(sse("structured", response)));
        controller.enqueue(enc.encode(sse("done", { ...meta, messageId })));
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
