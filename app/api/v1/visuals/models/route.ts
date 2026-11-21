// 3D model catalog (RF-M08-05, Prompt 2.6).
//   GET    /api/v1/visuals/models            -> every model the student can open: those built in code and those uploaded by the admin (with theme)
//   GET    /api/v1/visuals/models?id=        -> one uploaded model in full (hotspots, camera, file link); code models are in the app bundle
//   GET    /api/v1/visuals/models?admin=1    -> admin only: uploaded models including inactive ones
//   POST   /api/v1/visuals/models            -> admin only, multipart { meta (JSON), file? (.glb, up to 3.5 MB) }: add or change an uploaded model
//   DELETE /api/v1/visuals/models?id=        -> admin only: remove an uploaded model and its file
// One function for all of it (Vercel Hobby allows 12 functions per deployment).
import { anonClient, errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";
import { MODELS_3D, themeOf } from "@/lib/visuals/models3d";
import { ModelMeta, violatesRa20 } from "@/lib/visuals/model-meta";

import { MAX_GLB } from "@/lib/visuals/model-meta";

export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (url.searchParams.get("admin")) {
      const { db } = await requireAdmin(req);
      const { data, error } = await db.rpc("api_admin_models");
      if (error) throw new HttpError(500, "models_failed");
      return Response.json({ models: data ?? [], builtin: MODELS_3D.map((m) => ({ id: m.id, name: m.name })) });
    }
    const db = anonClient();
    if (id) {
      const { data } = await db.from("models3d").select("id, name, alt, note, theme, refs, camera, hotspots, license, sources, file_url, size_bytes").eq("id", id).maybeSingle();
      if (!data) throw new HttpError(404, "not_found");
      return Response.json({ model: data }, { headers: { "Cache-Control": "public, max-age=600" } });
    }
    const { data } = await db.from("models3d").select("id, name, alt, theme, size_bytes").order("name");
    const models = [...MODELS_3D.map((m) => ({ id: m.id, name: m.name, alt: m.alt, theme: themeOf(m.id), source: "code" as const })), ...(data ?? []).filter((r) => !MODELS_3D.some((m) => m.id === r.id)).map((r) => ({ id: r.id, name: r.name, alt: r.alt, theme: r.theme, source: "upload" as const, size_bytes: r.size_bytes }))];
    return Response.json({ models, themes: [...new Set(models.map((m) => m.theme))] }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { db, user } = await requireAdmin(req);
    const form = await req.formData().catch(() => null);
    const raw = form?.get("meta");
    const meta = ModelMeta.safeParse(typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null);
    if (!meta.success) throw new HttpError(400, "invalid_meta", { issues: meta.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
    const m = meta.data;
    if (MODELS_3D.some((x) => x.id === m.id)) throw new HttpError(409, "id_taken_by_builtin");
    // RA-20: nothing that represents the face of Jesus or God the Father enters the catalog.
    for (const text of [m.name, m.alt, m.note, ...m.hotspots.flatMap((h) => [h.label, h.text])]) if (violatesRa20(text)) throw new HttpError(422, "ra20_refused");
    const file = form?.get("file");
    let fileUrl: string | null = null, size: number | null = null;
    if (file instanceof Blob && file.size > 0) {
      if (file.size > MAX_GLB) throw new HttpError(413, "file_too_large");
      const head = new TextDecoder().decode(new Uint8Array(await file.slice(0, 4).arrayBuffer()));
      if (head !== "glTF") throw new HttpError(415, "not_glb");
      const path = `${m.id}.glb`;
      const up = await db.storage.from("models3d").upload(path, file, { contentType: "model/gltf-binary", upsert: true });
      if (up.error) throw new HttpError(500, "upload_failed");
      fileUrl = db.storage.from("models3d").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
      size = file.size;
    }
    if (!fileUrl) {
      const { data: existing } = await db.from("models3d").select("file_url").eq("id", m.id).maybeSingle();
      if (!existing?.file_url) throw new HttpError(400, "file_required");
    }
    const { error } = await db.rpc("api_admin_set_model", { p_id: m.id, p_name: m.name, p_alt: m.alt, p_note: m.note, p_theme: m.theme, p_refs: m.refs, p_camera: m.camera, p_hotspots: m.hotspots, p_license: m.license, p_sources: m.sources, p_file_url: fileUrl, p_size: size, p_active: m.active });
    if (error) throw new HttpError(500, "save_failed");
    void user;
    return Response.json({ ok: true, id: m.id, file_url: fileUrl }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[a-z][a-z0-9_]{2,39}$/.test(id)) throw new HttpError(400, "invalid_request");
    await db.storage.from("models3d").remove([`${id}.glb`]);
    const { error } = await db.rpc("api_admin_delete_model", { p_id: id });
    if (error) throw new HttpError(500, "delete_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
