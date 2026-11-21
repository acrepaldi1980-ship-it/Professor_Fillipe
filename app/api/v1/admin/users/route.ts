// GET /api/v1/admin/users?q= -> users with plan and situation (never their conversations). GET ?payments=<uuid> -> payment events of one user.
// PATCH {userId, role} -> student or reviewer (admins are made in the database). Admin only; audited.
import { z } from "zod";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const p = new URL(req.url).searchParams;
    const pay = p.get("payments");
    if (pay) {
      if (!/^[0-9a-f-]{36}$/.test(pay)) throw new HttpError(400, "invalid_request");
      const { data } = await db.rpc("api_admin_user_payments", { p_user: pay });
      return Response.json({ payments: data ?? [] });
    }
    const { data, error } = await db.rpc("api_admin_users", { p_q: (p.get("q") ?? "").slice(0, 80) });
    if (error) throw new HttpError(500, "users_failed");
    return Response.json({ users: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

const patch = z.object({ userId: z.string().uuid(), role: z.enum(["student", "reviewer"]) });
export async function PATCH(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const parsed = patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { error } = await db.rpc("api_admin_set_role", { p_user: parsed.data.userId, p_role: parsed.data.role });
    if (error) throw new HttpError(400, "role_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
