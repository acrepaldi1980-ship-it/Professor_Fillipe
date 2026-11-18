// POST /api/v1/feedback { rating 1-5, comment?, sessionRef? } (prototype). Stores no conversation text.
import { z } from "zod";
import { anonClient } from "@/lib/auth/server";

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
  const { error } = await anonClient().rpc("api_submit_feedback", { p_rating: rating, p_comment: comment ?? null, p_session_ref: sessionRef ?? null });
  if (error) return Response.json({ error: "feedback_unavailable" }, { status: 502 });
  return Response.json({ ok: true }, { status: 201 });
}
