// GET /api/v1/admin/billing -> subscribers by plan and status, recurring revenue, cancellations and AI cost per user. Admin only.
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const { data, error } = await db.rpc("api_admin_billing");
    if (error) throw new HttpError(500, "billing_report_failed");
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
