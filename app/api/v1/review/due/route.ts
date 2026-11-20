// GET /api/v1/review/due?limit=10 -> the cards due now (RF-M09-05 "Revisão do dia") and how many are due in total.
import { errorResponse, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    const limit = Math.min(30, Number(new URL(req.url).searchParams.get("limit")) || 10);
    const now = new Date().toISOString();
    const [{ data: cards }, { count }] = await Promise.all([
      db.from("review_cards").select("id, question, ref, session_id").lte("due_at", now).order("due_at").limit(limit),
      db.from("review_cards").select("id", { count: "exact", head: true }).lte("due_at", now),
    ]);
    return Response.json({ cards: cards ?? [], total: count ?? 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
