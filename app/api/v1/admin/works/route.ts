// GET /api/v1/admin/works -> every work with its license, status and chunk count (library chunks from Neon). PATCH {id, enabled} -> enable/disable.
// Admin only (checked here and again inside the database functions); every change is audited.
import { z } from "zod";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const { data, error } = await db.rpc("api_admin_works");
    if (error) throw new HttpError(500, "works_failed");
    const lib = await refQuery<{ work_id: string; n: number }>("select work_id, count(*)::int n from chunks group by 1").catch(() => []);
    const n = new Map(lib.map((r) => [r.work_id, r.n]));
    return Response.json({ works: (data as { id: string; chunk_count: number }[]).map((w) => ({ ...w, chunk_count: Number(w.chunk_count) || n.get(w.id) || 0 })) });
  } catch (e) {
    return errorResponse(e);
  }
}

const patch = z.object({ id: z.string().min(1).max(100), enabled: z.boolean() });
export async function PATCH(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const parsed = patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { error } = await db.rpc("api_admin_set_work", { p_id: parsed.data.id, p_enabled: parsed.data.enabled });
    if (error) throw new HttpError(500, "update_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
