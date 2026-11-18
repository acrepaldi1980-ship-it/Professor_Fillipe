// POST /api/v1/consents { kind, granted }: records a consent decision with the current terms version (RF-M02-01/02).
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/auth/server";
import { CONSENT_KINDS, recordConsent, TERMS_VERSION } from "@/lib/auth/profile";

export const runtime = "nodejs";
const body = z.object({ kind: z.enum(CONSENT_KINDS), granted: z.boolean() });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
    await recordConsent(db, user.id, parsed.data.kind, parsed.data.granted, TERMS_VERSION);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
