// Environment tool endpoints (Prompt 3.4), served by the /api/v1/study/[...path] function:
//   GET    /study/environments           -> published environments (code and uploaded): id, title, era, size
//   GET    /study/environments?id=       -> one package (published; an admin also sees drafts)
//   GET    /study/environments?admin=1   -> admin: every environment with its performance report
//   POST   /study/environments           -> admin, multipart { meta (JSON: package + status), glb:<zoneId> files }: validate, upload, save or publish
//   DELETE /study/environments?id=       -> admin: remove an environment and its files
import { z } from "zod";
import { anonClient, errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";
import { violatesRa20 } from "@/lib/visuals/model-meta";
import { checkGlb, LIMITS, type GlbReport } from "./glb-check";
import { EnvironmentPackage } from "./package";
import { PACKAGES } from "./registry";

const CODE_SCENES = new Set(["test_yard", "test_altar", "glb"]);
const Meta = z.object({ package: z.unknown(), status: z.enum(["draft", "published"]).default("draft") });

export async function envGet(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (url.searchParams.get("admin")) {
      const { db } = await requireAdmin(req);
      const { data } = await db.from("environments").select("id, title, status, size_bytes, reports, updated_at, data").order("updated_at", { ascending: false });
      return Response.json({ environments: data ?? [], limits: LIMITS });
    }
    if (id) {
      if (PACKAGES[id]) return Response.json({ package: PACKAGES[id], source: "code" });
      let db = anonClient();
      // an admin previews drafts with their own token
      const auth = req.headers.get("authorization");
      if (auth) { try { db = (await requireAdmin(req)).db; } catch { db = anonClient(); } }
      const { data } = await db.from("environments").select("data, status").eq("id", id).maybeSingle();
      if (!data) throw new HttpError(404, "not_found");
      return Response.json({ package: data.data, source: "upload", status: data.status }, { headers: { "Cache-Control": data.status === "published" ? "public, max-age=300" : "no-store" } });
    }
    const { data } = await anonClient().from("environments").select("id, title, size_bytes, data").eq("status", "published").order("title");
    const uploaded = (data ?? []).map((r) => ({ id: r.id as string, title: r.title as string, era: (r.data as { era?: string }).era ?? "", size_bytes: r.size_bytes as number, source: "upload" as const }));
    const code = Object.values(PACKAGES).map((p) => ({ id: p.id, title: p.title, era: p.era, size_bytes: 0, source: "code" as const }));
    return Response.json({ environments: [...code, ...uploaded] }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function envPost(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const form = await req.formData().catch(() => null);
    const raw = form?.get("meta");
    const meta = Meta.safeParse(typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null);
    if (!meta.success) throw new HttpError(400, "invalid_meta");
    const parsed = EnvironmentPackage.safeParse(meta.data.package);
    if (!parsed.success) throw new HttpError(400, "invalid_package", { issues: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`) });
    const pkg = parsed.data;
    if (PACKAGES[pkg.id]) throw new HttpError(409, "id_taken_by_builtin");
    // RA-20 on every text the student will read or hear
    const texts = [pkg.title, pkg.era, pkg.sheet.summary, ...pkg.hotspots.flatMap((h) => [h.label, h.text]), ...pkg.stations.flatMap((s) => [s.title, s.script])];
    if (texts.some((t) => violatesRa20(t))) throw new HttpError(422, "ra20_refused");

    // zones: a built-in scene, or a GLB file checked for performance and uploaded
    const reports: Record<string, GlbReport> = {};
    let total = 0;
    // zones whose file is not sent again keep the one already stored for this environment
    const { data: prev } = await db.from("environments").select("data").eq("id", pkg.id).maybeSingle();
    const stored = new Map(((prev?.data as { zones?: { id: string; model?: { url: string; scale: number; y: number; size?: number } }[] } | undefined)?.zones ?? []).filter((z) => z.model).map((z) => [z.id, z.model!]));
    for (const z of pkg.zones) {
      if (z.scene !== "glb") {
        if (!CODE_SCENES.has(z.scene)) throw new HttpError(422, "unknown_scene", { zone: z.id });
        continue;
      }
      const f = form?.get(`glb:${z.id}`);
      if (f instanceof Blob && f.size > 0) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const rep = checkGlb(bytes);
        reports[z.id] = rep;
        total += rep.bytes;
        if (!rep.ok) throw new HttpError(422, "glb_rejected", { zone: z.id, problems: rep.problems, report: rep });
        const path = `${pkg.id}/${z.id}.glb`;
        const up = await db.storage.from("environments").upload(path, bytes, { contentType: "model/gltf-binary", upsert: true });
        if (up.error) throw new HttpError(500, "upload_failed");
        z.model = { scale: 1, y: 0, ...(z.model ?? {}), url: `${db.storage.from("environments").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`, size: rep.bytes };
      } else if (!z.model?.url && stored.has(z.id)) {
        z.model = { ...stored.get(z.id)!, ...(z.model ?? {}), url: stored.get(z.id)!.url };
        total += z.model.size ?? 0;
      } else if (!z.model?.url) {
        throw new HttpError(400, "glb_required", { zone: z.id });
      } else total += z.model.size ?? 0;
    }
    if (meta.data.status === "published" && Object.values(reports).some((r) => !r.ok)) throw new HttpError(422, "glb_rejected");
    const { error } = await db.rpc("api_admin_set_environment", { p_id: pkg.id, p_title: pkg.title, p_data: pkg, p_status: meta.data.status, p_size: total, p_reports: reports });
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true, id: pkg.id, status: meta.data.status, size_bytes: total, reports }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function envDelete(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[a-z][a-z0-9_]{2,39}$/.test(id)) throw new HttpError(400, "invalid_request");
    const { data: files } = await db.storage.from("environments").list(id);
    if (files?.length) await db.storage.from("environments").remove(files.map((f) => `${id}/${f.name}`));
    const { error } = await db.rpc("api_admin_delete_environment", { p_id: id });
    if (error) throw new HttpError(500, "delete_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
