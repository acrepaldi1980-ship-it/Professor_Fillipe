// POST /api/v1/feedback { rating 1-5, comment?, sessionRef? } (prototype). Stores no conversation text.
import { z } from "zod";
import { getDb, lit } from "@/lib/knowledge/db";

export const runtime = "nodejs";
const body = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  sessionRef: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const { rating, comment, sessionRef } = parsed.data;
  try {
    await getDb().exec!(`insert into feedback (rating, comment, session_ref) values (${rating}, ${comment ? lit(comment) : "null"}, ${sessionRef ? lit(sessionRef) : "null"})`);
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "feedback_unavailable" }, { status: 502 });
  }
}
