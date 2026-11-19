// GET /api/v1/admin/notes?status=draft -> list of own notes (reviewers and admins). Row Level Security does the filtering.
import { errorResponse, requireReviewer } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireReviewer(req);
    const status = new URL(req.url).searchParams.get("status");
    let q = ctx.db.from("own_notes").select("id,kind,book_code,ref_range,title,status,originality_score,rewrite_count,updated_at").order("book_code").order("created_at").limit(500);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error("db_error");
    return Response.json({ role: ctx.role, items: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
