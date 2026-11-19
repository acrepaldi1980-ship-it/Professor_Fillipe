// GET -> a note with its comments; PATCH {status?, body?, title?} -> edit or move through the workflow.
// Publishing (admin) also puts the note into the search index (api_publish_note); leaving "published" removes it.
import { errorResponse, HttpError, requireReviewer } from "@/lib/auth/server";
import { getEmbeddingProvider } from "@/lib/knowledge/embeddings";
import { canMove, type NoteStatus } from "@/lib/notes/status";
import { PatchRequest } from "@/lib/notes/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireReviewer(req);
    const { id } = await params;
    const { data: note } = await ctx.db.from("own_notes").select("*").eq("id", id).maybeSingle();
    if (!note) throw new HttpError(404, "not_found");
    const { data: comments } = await ctx.db.from("own_note_comments").select("id,user_id,body,created_at").eq("note_id", id).order("created_at");
    return Response.json({ role: ctx.role, note, comments: comments ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireReviewer(req);
    const { id } = await params;
    const parsed = PatchRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data: cur } = await ctx.db.from("own_notes").select("status,body,title").eq("id", id).maybeSingle();
    if (!cur) throw new HttpError(404, "not_found");
    const from = cur.status as NoteStatus;
    const patch: Record<string, unknown> = {};
    if (parsed.data.body !== undefined || parsed.data.title !== undefined) {
      if (from === "published" || from === "approved") throw new HttpError(409, "edit_requires_draft");
      if (parsed.data.body !== undefined) patch.body = parsed.data.body;
      if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    }
    const to = parsed.data.status;
    if (to && to !== from) {
      if (!canMove(from, to, ctx.role)) throw new HttpError(403, "illegal_status_move");
      patch.status = to;
    }
    if (Object.keys(patch).length) {
      const { error } = await ctx.db.from("own_notes").update(patch).eq("id", id);
      if (error) throw new HttpError(error.message.includes("illegal") || error.message.includes("only_admin") ? 403 : 500, "update_failed");
    }
    if (to === "published") {
      const body = (patch.body as string | undefined) ?? cur.body;
      const [vec] = await getEmbeddingProvider().embedPassages([`${cur.title}\n${body}`]);
      const { error } = await ctx.db.rpc("api_publish_note", { p_note: id, p_embedding: `[${vec.map((x) => x.toFixed(6)).join(",")}]` });
      if (error) throw new HttpError(500, "publish_failed");
    } else if (from === "published" && to) {
      await ctx.db.rpc("api_unpublish_note", { p_note: id });
    }
    return Response.json({ ok: true, status: to ?? from });
  } catch (e) {
    return errorResponse(e);
  }
}
