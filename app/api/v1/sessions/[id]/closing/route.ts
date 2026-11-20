// GET -> the closing of a session: summary text, mind map and its review cards.
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireUser(req);
    const { id } = await params;
    const [{ data: closing }, { data: cards }] = await Promise.all([
      db.from("session_closings").select("summary, mind_map, topics").eq("session_id", id).maybeSingle(),
      db.from("review_cards").select("id, question, answer, ref").eq("session_id", id).order("created_at"),
    ]);
    if (!closing) throw new HttpError(404, "no_closing");
    return Response.json({ ...closing, cards: cards ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
