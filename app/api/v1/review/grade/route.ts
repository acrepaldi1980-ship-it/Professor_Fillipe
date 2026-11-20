// POST /api/v1/review/grade { cardId, answer } -> the teacher grades the spoken answer (wrong, partial, right), gives a short reply and
// the card is rescheduled with SM-2 (RF-M09-02/03). The expected answer is only returned together with the feedback.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { shortTaskLlm } from "@/lib/notes/llm";
import { evaluateAnswer } from "@/lib/review/closing";
import { GRADE_OF, schedule } from "@/lib/review/sm2";

export const runtime = "nodejs";
export const maxDuration = 30;
const body = z.object({ cardId: z.string().uuid(), answer: z.string().max(1200) });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data: card } = await db.from("review_cards").select("*").eq("id", parsed.data.cardId).maybeSingle();
    if (!card) throw new HttpError(404, "card_not_found");
    const { data: prof } = await db.from("profiles").select("preferred_name, display_name").eq("user_id", user.id).maybeSingle();
    const name = prof?.preferred_name || prof?.display_name || "amigo";
    const ev = await evaluateAnswer({ question: card.question, answer: card.answer }, parsed.data.answer, name, shortTaskLlm());
    const grade = GRADE_OF[ev.verdict];
    const next = schedule({ ease: Number(card.ease), interval_days: card.interval_days, repetitions: card.repetitions }, grade, new Date());
    await db.from("review_cards").update({ ease: next.ease, interval_days: next.interval_days, repetitions: next.repetitions, due_at: next.due_at.toISOString(), last_grade: grade }).eq("id", card.id);
    await db.from("review_logs").insert({ card_id: card.id, user_id: user.id, grade });
    return Response.json({ verdict: ev.verdict, feedback: ev.feedback, expected: card.answer, nextInDays: next.interval_days });
  } catch (e) {
    return errorResponse(e);
  }
}
