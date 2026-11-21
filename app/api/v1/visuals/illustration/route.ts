// POST /api/v1/visuals/illustration { prompt, alt? } -> { hash, alt } (generated or from cache), or { status: refused | limit | unavailable }.
import { z } from "zod";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { loadAccess } from "@/lib/entitlements/server";
import { getOrCreateIllustration } from "@/lib/visuals/illustrations";

export const runtime = "nodejs";
export const maxDuration = 60;
const body = z.object({ prompt: z.string().min(8).max(400), alt: z.string().max(300).optional() });

export async function POST(req: Request) {
  try {
    const { db, user: u } = await requireUser(req);
    await enforceRate(db, `u:${u.id}:illustration`, LIMITS.illustration);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const access = await loadAccess(db, u.id);
    const r = await getOrCreateIllustration(db, parsed.data, { dailyLimit: access.limits.illustrations_day ?? 30 });
    return Response.json(r, { status: r.status === "ok" ? 200 : r.status === "limit" ? 429 : r.status === "refused" ? 422 : 503 });
  } catch (e) {
    return errorResponse(e);
  }
}
