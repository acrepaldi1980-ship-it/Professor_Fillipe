// DELETE /api/v1/account { confirm: "EXCLUIR" }: removes the account and all personal data (RF-M01-03).
// Every user table references auth.users with ON DELETE CASCADE, so removing the auth user erases the rest.
// Uses the restricted function api_delete_my_account() with the user's own token (no account-level credential).
import { z } from "zod";
import { errorResponse, HttpError, requireUserStrict } from "@/lib/auth/server";

export const runtime = "nodejs";
const body = z.object({ confirm: z.literal("EXCLUIR") });

export async function DELETE(req: Request) {
  try {
    const { db } = await requireUserStrict(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "confirmation_required" }, { status: 400 });
    const { error } = await db.rpc("api_delete_my_account");
    if (error) throw new HttpError(500, "delete_failed");
    return new Response(null, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
