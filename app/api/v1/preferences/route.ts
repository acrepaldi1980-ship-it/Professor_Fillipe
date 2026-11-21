// GET/PUT /api/v1/preferences { lenses } -> the student's theological lenses (spec 8.3/8.5). Needs the religious-data consent to store.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { loadConsents } from "@/lib/auth/profile";
import { track } from "@/lib/analytics/track";
import { LENSES, readLenses, saveLenses } from "@/lib/auth/preferences";

export const runtime = "nodejs";
const body = z.object({ lenses: z.array(z.enum(LENSES)).max(3).optional(), main_version_id: z.string().max(60).optional(), compare_version_ids: z.array(z.string().max(60)).max(3).optional() });

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const [{ data: versions }, { data: p }] = await Promise.all([
      db.from("bible_versions").select("id,name,abbreviation,language,audience").order("language").order("name"),
      db.from("preferences").select("main_version_id, compare_version_ids").eq("user_id", user.id).maybeSingle(),
    ]);
    return Response.json({ lenses: await readLenses(db, user.id), available: LENSES, versions: versions ?? [], main_version_id: p?.main_version_id ?? "por_blivre_2018", compare_version_ids: p?.compare_version_ids ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { lenses, main_version_id, compare_version_ids } = parsed.data;
    if (lenses?.length && !(await loadConsents(db, user.id)).sensitive_religious?.granted) throw new HttpError(403, "consent_required");
    if (lenses) {
      const { error } = await saveLenses(db, user.id, lenses);
      if (error) throw new HttpError(500, "save_failed");
    }
    if (main_version_id || compare_version_ids) {
      // Only enabled, licensed versions are visible (RLS on bible_versions); anything else is rejected.
      const ids = [main_version_id, ...(compare_version_ids ?? [])].filter((x): x is string => !!x);
      const { data: ok } = await db.from("bible_versions").select("id").in("id", ids);
      if ((ok ?? []).length !== new Set(ids).size) throw new HttpError(400, "invalid_version");
      const patch: Record<string, unknown> = { user_id: user.id };
      if (main_version_id) patch.main_version_id = main_version_id;
      if (compare_version_ids) patch.compare_version_ids = compare_version_ids;
      const { error } = await db.from("preferences").upsert(patch, { onConflict: "user_id" });
      if (error) throw new HttpError(500, "save_failed");
    }
    track(db, "config_completed", { lenses: lenses?.length ?? 0 });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
