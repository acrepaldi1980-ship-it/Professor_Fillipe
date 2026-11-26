// GET/PUT /api/v1/reader/state -> the reader's version, comparison version, last position and letter size (spec 8.24, RF-M24-01).
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { StateInput } from "@/lib/reading/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const [{ data: st }, { data: pref }] = await Promise.all([
      db.from("reader_state").select("version_id, compare_version_id, last_ref, font_scale").eq("user_id", user.id).maybeSingle(),
      db.from("preferences").select("main_version_id").eq("user_id", user.id).maybeSingle(),
    ]);
    return Response.json({ version_id: st?.version_id ?? pref?.main_version_id ?? "por_blivre_2018", compare_version_id: st?.compare_version_id ?? null, last_ref: st?.last_ref ?? null, font_scale: Number(st?.font_scale ?? 1), chosen: !!st });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = StateInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data: cur } = await db.from("reader_state").select("version_id").eq("user_id", user.id).maybeSingle();
    const version_id = parsed.data.version_id ?? cur?.version_id;
    if (!version_id) throw new HttpError(400, "version_required");
    const row = { user_id: user.id, version_id, updated_at: new Date().toISOString(), ...(parsed.data.compare_version_id !== undefined ? { compare_version_id: parsed.data.compare_version_id } : {}), ...(parsed.data.last_ref ? { last_ref: parsed.data.last_ref } : {}), ...(parsed.data.font_scale ? { font_scale: parsed.data.font_scale } : {}) };
    const { error } = await db.from("reader_state").upsert(row, { onConflict: "user_id" });
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
