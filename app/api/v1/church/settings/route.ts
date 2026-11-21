// PUT { churchId, lenses, versionId } -> default lens and Bible version of the church (administrator only); the student can widen them.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";

export const runtime = "nodejs";
const body = z.object({ churchId: z.string().uuid(), lenses: z.array(z.string().max(40)).max(3), versionId: z.string().max(60).nullable().optional() });

export async function PUT(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { error } = await db.rpc("api_church_settings", { p_church: p.data.churchId, p_lenses: p.data.lenses, p_version: p.data.versionId ?? null });
    if (error) throw rpcError(error.message);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
