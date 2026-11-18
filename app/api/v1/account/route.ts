// DELETE /api/v1/account { confirm: "EXCLUIR" }: removes the account and all personal data (RF-M01-03).
// Every user table references auth.users with ON DELETE CASCADE, so removing the auth user erases the rest.
// Prototype: runs through the server-side database connection; production uses the service role.
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/auth/server";
import { getDb, lit } from "@/lib/knowledge/db";

export const runtime = "nodejs";
const body = z.object({ confirm: z.literal("EXCLUIR") });

export async function DELETE(req: Request) {
  try {
    const { user } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "confirmation_required" }, { status: 400 });
    await getDb().exec!(`delete from auth.users where id = ${lit(user.id)}::uuid`);
    return new Response(null, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
