// POST /api/v1/teacher/turn (spec 10.5): one teacher turn, answered as Server-Sent Events.
// Requires login. Events: `structured` (the validated contract), `done` (metrics), `error`.
// Persistence: the conversation is saved in `messages`; for a pastoral crisis NO text is stored, only the event (spec 8.5.8).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { studentForPrompt } from "@/lib/auth/profile";
import { createTurnDeps, teacherProvider } from "@/lib/teacher/deps";
import { runTurn } from "@/lib/teacher/pipeline";
import { INTENTS } from "@/lib/teacher/schema";

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

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const student = await studentForPrompt(db, user.id);
        const { response, meta } = await runTurn({ ...parsed.data, student }, createTurnDeps());

        if (response.pastoral_flag) {
          await db.from("pastoral_events").insert({ user_id: user.id });
        } else {
          const rows = [
            { session_id: session.id, role: "user", text: parsed.data.text },
            { session_id: session.id, role: "teacher", text: response.display_markdown || response.speech, speech: response.speech, structured: response, latency_ms: meta.latencyMs },
          ];
          await db.from("messages").insert(rows);
        }

        // Never log the student's text (spec 13): only metrics.
        console.log(JSON.stringify({ evt: "turn", ...meta }));
        controller.enqueue(enc.encode(sse("structured", response)));
        controller.enqueue(enc.encode(sse("done", meta)));
      } catch (e) {
        console.error(JSON.stringify({ evt: "turn_error", code: (e as Error).message.slice(0, 80) }));
        controller.enqueue(enc.encode(sse("error", { code: "turn_failed" })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
