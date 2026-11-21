// POST { section, instruction? } -> researches and writes ONE section of the lesson plan, the sermon outline or the deep study into the document
// (see lib/modes/build.ts). The screen calls it step by step to deliver the whole document; `instruction` changes an existing section.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { BuildError, buildSection } from "@/lib/modes/build";
import { loadSessionMode } from "@/lib/modes/server";
import { enforceRate, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
const body = z.object({ section: z.string().min(3).max(40), instruction: z.string().max(500).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, db } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:turn`, LIMITS.turn);
    const { id } = await params;
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const sm = await loadSessionMode(db, id);
    if (!sm) throw new HttpError(404, "session_not_found");
    try {
      return Response.json({ ok: true, ...(await buildSection(db, user.id, sm, parsed.data.section, parsed.data.instruction)) });
    } catch (e) {
      if (e instanceof BuildError) throw new HttpError(e.status, e.code, e.extra);
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
