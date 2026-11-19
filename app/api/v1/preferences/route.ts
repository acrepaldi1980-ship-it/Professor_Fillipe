// GET/PUT /api/v1/preferences { lenses } -> the student's theological lenses (spec 8.3/8.5). Needs the religious-data consent to store.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { loadConsents } from "@/lib/auth/profile";
import { LENSES, readLenses, saveLenses } from "@/lib/auth/preferences";

export const runtime = "nodejs";
const body = z.object({ lenses: z.array(z.enum(LENSES)).max(3) });

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    return Response.json({ lenses: await readLenses(db, user.id), available: LENSES });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    if (parsed.data.lenses.length && !(await loadConsents(db, user.id)).sensitive_religious?.granted) throw new HttpError(403, "consent_required");
    const { error } = await saveLenses(db, user.id, parsed.data.lenses);
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
