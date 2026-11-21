// GET /api/v1/admin/flags?status=open|correct|incorrect|all -> answers flagged by students or sampled for audit (reviewers and admins).
// PATCH {id, status, note} -> the reviewer decides. Only the answer and the question that led to it are visible, nothing else of the conversation.
import { z } from "zod";
import { errorResponse, HttpError, requireReviewer } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireReviewer(req);
    const status = new URL(req.url).searchParams.get("status") ?? "open";
    const { data, error } = await db.rpc("api_flagged_answers", { p_status: ["open", "correct", "incorrect", "all"].includes(status) ? status : "open" });
    if (error) throw new HttpError(500, "flags_failed");
    return Response.json({ flags: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

const patch = z.object({ id: z.string().uuid(), status: z.enum(["open", "correct", "incorrect"]), note: z.string().max(1000).default("") });
export async function PATCH(req: Request) {
  try {
    const { db } = await requireReviewer(req);
    const parsed = patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { error } = await db.rpc("api_review_flag", { p_id: parsed.data.id, p_status: parsed.data.status, p_note: parsed.data.note });
    if (error) throw new HttpError(500, "review_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
