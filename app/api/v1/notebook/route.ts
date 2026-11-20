// GET /api/v1/notebook?q=&book=ACT&kind=session -> the student's notebook (RF-M09-04), newest first.
import { errorResponse, requireUser } from "@/lib/auth/server";
import { loadNotebook } from "@/lib/review/notebook";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = new URL(req.url).searchParams;
    const items = await loadNotebook(db, { q: p.get("q") ?? undefined, book: p.get("book") ?? undefined, kind: p.get("kind") ?? undefined });
    return Response.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
