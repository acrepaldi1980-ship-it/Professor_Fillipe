// POST /api/v1/sessions/:id/close -> ends the session and, with enough conversation, writes the closing (RF-M09-01): the spoken summary,
// the mind map and 3 to 7 review cards, plus the short summary used as long-term memory (8.5.4). A pastoral exchange is never stored,
// so it is never summarized.
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { shortTaskLlm } from "@/lib/notes/llm";
import { generateClosing } from "@/lib/review/closing";

export const runtime = "nodejs";
export const maxDuration = 45;

const firstWords = (s: string, n: number) => s.split(/\s+/).slice(0, n).join(" ");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, db } = await requireUser(req);
    const { id } = await params;
    const { data: session } = await db.from("sessions").select("id, mode, topic").eq("id", id).maybeSingle();
    if (!session) throw new HttpError(404, "session_not_found");
    await db.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", id);
    const { data: msgs } = await db.from("messages").select("role,text,speech").eq("session_id", id).order("created_at");
    const turns = (msgs ?? []).map((m) => ({ role: m.role as "user" | "teacher", text: m.role === "teacher" ? m.speech || m.text : m.text }));
    if (turns.filter((t) => t.role === "teacher").length < 2) return Response.json({ ok: true, closed: false });
    const { data: prof } = await db.from("profiles").select("preferred_name, display_name").eq("user_id", user.id).maybeSingle();
    const name = prof?.preferred_name || prof?.display_name || "amigo";
    const c = await generateClosing(turns, name, shortTaskLlm()).catch(() => null);
    if (!c) return Response.json({ ok: true, closed: false });

    await db.from("session_closings").upsert({ session_id: id, summary: c.summary, mind_map: c.mind_map, topics: c.topics }, { onConflict: "session_id" });
    await db.from("session_summaries").upsert({ session_id: id, user_id: user.id, summary: firstWords(c.summary, 70), topics: c.topics, level_signal: c.level_signal });
    // cards: the same question in the same session is never inserted twice (unique index)
    await db.from("review_cards").upsert(c.cards.map((k) => ({ user_id: user.id, session_id: id, question: k.question, answer: k.answer, ref: k.ref ?? null })), { onConflict: "user_id,session_id,question", ignoreDuplicates: true });
    // the notebook keeps the closing (kind session) with its books for filtering
    const books = [...new Set(c.cards.map((k) => k.ref?.split(".")[0]).filter((x): x is string => !!x))];
    await db.from("notebook_items").delete().eq("session_id", id).eq("kind", "session");
    await db.from("notebook_items").insert({ user_id: user.id, session_id: id, kind: "session", title: session.topic || c.topics[0] || "Sessão de estudo", content: { summary: c.summary, mind_map: c.mind_map }, tags: c.topics, book_codes: books });
    return Response.json({ ok: true, closed: true, cards: c.cards.length });
  } catch (e) {
    return errorResponse(e);
  }
}
