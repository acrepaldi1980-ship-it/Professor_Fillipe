// POST { churchId } -> the person leaves the church (rights from the church end at once). The administrator cannot leave.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";

export const runtime = "nodejs";
const body = z.object({ churchId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { error } = await db.rpc("api_church_leave", { p_church: p.data.churchId });
    if (error) throw rpcError(error.message);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
