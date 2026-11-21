// GET /api/v1/admin/audit -> the latest administrative actions (audit_logs). Admin only.
import { errorResponse, requireAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const { data } = await db.rpc("api_admin_audit");
    return Response.json({ entries: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
