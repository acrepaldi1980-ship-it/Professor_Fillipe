// POST /api/v1/teacher/flag { messageId, reason? } -> the student marks an answer as wrong ("Isso está errado?"), kept in answer_flags
// for the reviewers. RLS: only the student's own messages can be flagged.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";
const body = z.object({ messageId: z.string().uuid(), reason: z.string().max(500).optional() });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data: msg } = await db.from("messages").select("id").eq("id", parsed.data.messageId).eq("role", "teacher").maybeSingle();
    if (!msg) throw new HttpError(404, "message_not_found");
    const { error } = await db.from("answer_flags").insert({ message_id: msg.id, user_id: user.id, reason: parsed.data.reason ?? null });
    if (error) throw new HttpError(500, "flag_failed");
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
