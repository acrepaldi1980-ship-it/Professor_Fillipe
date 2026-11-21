// POST { code } -> joins with a class code (student) or the church teacher code (teacher). The answer carries what the screen must tell the person (privacy notice).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";
import { enforceRate } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const body = z.object({ code: z.string().trim().min(6).max(20) });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:join`, { limit: 10, windowSeconds: 600 }); // codes cannot be guessed by brute force
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.rpc("api_church_join", { p_code: p.data.code });
    if (error) throw rpcError(error.message);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
