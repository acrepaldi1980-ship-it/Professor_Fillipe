// POST /api/v1/teacher/turn (spec 10.5): one teacher turn, answered as Server-Sent Events.
// Events: `structured` (the validated contract), `done` (metrics), `error`.
import { z } from "zod";
import { createTurnDeps, teacherProvider } from "@/lib/teacher/deps";
import { runTurn } from "@/lib/teacher/pipeline";
import { INTENTS } from "@/lib/teacher/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().min(1).max(100),
  text: z.string().min(1).max(2000),
  intent: z.enum(INTENTS).optional(),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (teacherProvider() === "anthropic" && !process.env.ANTHROPIC_API_KEY) return Response.json({ error: "teacher_unavailable" }, { status: 503 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const { response, meta } = await runTurn(parsed.data, createTurnDeps());
        controller.enqueue(enc.encode(sse("structured", response)));
        // Never log the student's text (spec 13): only metrics.
        console.log(JSON.stringify({ evt: "turn", ...meta }));
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
