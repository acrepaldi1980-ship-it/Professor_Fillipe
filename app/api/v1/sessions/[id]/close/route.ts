// POST /api/v1/sessions/:id/close -> ends the session and writes its summary (long-term memory, spec 8.5.4).
// Sessions with fewer than 2 teacher answers get no summary. A pastoral exchange is never stored, so it is never summarized.
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { AnthropicNotesLlm } from "@/lib/notes/llm";
import { summarizeSession } from "@/lib/teacher/summary";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, db } = await requireUser(req);
    const { id } = await params;
    const { data: session } = await db.from("sessions").select("id,ended_at").eq("id", id).maybeSingle();
    if (!session) throw new HttpError(404, "session_not_found");
    await db.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", id);
    const { data: msgs } = await db.from("messages").select("role,text,speech").eq("session_id", id).order("created_at");
    const turns = (msgs ?? []).map((m) => ({ role: m.role as "user" | "teacher", text: m.role === "teacher" ? m.speech || m.text : m.text }));
    if (turns.filter((t) => t.role === "teacher").length < 2 || !process.env.ANTHROPIC_API_KEY) return Response.json({ ok: true, summarized: false });
    const { data: prof } = await db.from("profiles").select("level").eq("user_id", user.id).maybeSingle();
    const s = await summarizeSession(turns, (prof as { level?: string } | null)?.level ?? "iniciante", new AnthropicNotesLlm(undefined, process.env.SUMMARY_MODEL ?? "claude-haiku-5-5")).catch(() => null);
    if (!s) return Response.json({ ok: true, summarized: false });
    await db.from("session_summaries").upsert({ session_id: id, user_id: user.id, summary: s.summary, topics: s.topics, level_signal: s.level_signal });
    return Response.json({ ok: true, summarized: true });
  } catch (e) {
    return errorResponse(e);
  }
}
