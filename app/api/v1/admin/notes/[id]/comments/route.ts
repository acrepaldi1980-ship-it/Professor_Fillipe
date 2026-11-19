// POST {body} -> a reviewer comment on a note.
import { errorResponse, HttpError, requireReviewer } from "@/lib/auth/server";
import { CommentRequest } from "@/lib/notes/schema";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireReviewer(req);
    const { id } = await params;
    const parsed = CommentRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { error } = await ctx.db.from("own_note_comments").insert({ note_id: id, user_id: ctx.user.id, body: parsed.data.body });
    if (error) throw new HttpError(404, "not_found");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
