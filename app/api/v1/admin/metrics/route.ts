// GET /api/v1/admin/metrics -> the dashboard indicators of spec 15.2. Admin only.
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const [{ data: m, error }, { data: b }] = await Promise.all([db.rpc("api_admin_metrics"), db.rpc("api_admin_billing")]);
    if (error) throw new HttpError(500, "metrics_failed");
    return Response.json({ ...(m as object), billing: b });
  } catch (e) {
    return errorResponse(e);
  }
}
