"use client";

// Admin: build and publish immersive environments (Prompt 3.4). Fill in the package, add a GLB per zone (checked for size, triangles and textures
// before anything is sent), walk through it exactly as the student will, take positions for hotspots and stations from where you stand, and publish:
// students get it on demand, with no new version of the app. Admin only.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { adminEnvironments, ApiError, deleteEnvironment, getMe, saveEnvironment, type EnvAdminRow } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { checkGlb, LIMITS, type GlbReport } from "@/lib/immersive/glb-check";
import { EnvironmentPackage } from "@/lib/immersive/package";

const ImmersiveView = dynamic(() => import("@/components/immersive/ImmersiveView"), { ssr: false });

const TEMPLATE = {
  id: "meu_ambiente", title: "Meu ambiente", era: "Reconstrução esquemática", refs: "", spawn: "0, 8", bounds: "-20, -20, 20, 20",
  zones: JSON.stringify([{ id: "praca", name: "Praça", scene: "glb", center: [0, 0], load: 30, unload: 40, colliders: [] }], null, 1),
  hotspots: "[]", stations: "[]", sounds: JSON.stringify([{ id: "vento", kind: "ambient", layer: "wind", volume: 0.2 }], null, 1),
  summary: "Descreva o lugar em poucas frases, só com o que as fontes sustentam.", sources: "Texto bíblico e obra citada aqui", uncertainty: "Reconstrução esquemática.",
};
type Form = typeof TEMPLATE;
const nums = (s: string) => s.split(",").map((x) => Number(x.trim()));

function build(f: Form): { pkg?: unknown; error?: string } {
  try {
    const b = nums(f.bounds), sp = nums(f.spawn);
    return { pkg: { id: f.id.trim(), title: f.title, era: f.era, refs: f.refs.split(",").map((x) => x.trim()).filter(Boolean), spawn: sp, bounds: { min: [b[0], b[1]], max: [b[2], b[3]] }, zones: JSON.parse(f.zones), hotspots: JSON.parse(f.hotspots || "[]"), stations: JSON.parse(f.stations || "[]"), sounds: JSON.parse(f.sounds || "[]"), sheet: { summary: f.summary, sources: f.sources.split("\n").map((x) => x.trim()).filter(Boolean), uncertainty: f.uncertainty || undefined } } };
  } catch { return { error: t("env.err.json") }; }
}

export default function EnvironmentsAdminPage() {
  const [role, setRole] = useState<string | null>(null);
  const [rows, setRows] = useState<EnvAdminRow[]>([]);
  const [form, setForm] = useState<Form>(TEMPLATE);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [reports, setReports] = useState<Record<string, GlbReport>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [picked, setPicked] = useState<{ x: number; z: number; yaw: number } | null>(null);
  const [blobs, setBlobs] = useState<Record<string, string>>({});

  const load = useCallback(() => { void adminEnvironments().then((r) => setRows(r.environments)).catch(() => setMsg({ kind: "err", text: t("admin.error") })); }, []);
  useEffect(() => { void getMe().then((m) => setRole(m.profile?.role ?? "student")).catch(() => setRole("student")); }, []);
  useEffect(() => { if (role === "admin") load(); }, [role, load]);

  const built = useMemo(() => build(form), [form]);
  const glbZones = useMemo(() => { const z = (built.pkg as { zones?: { id: string; scene: string; model?: { url?: string } }[] } | undefined)?.zones; return Array.isArray(z) ? z.filter((x) => x.scene === "glb") : []; }, [built]);
  const existing = rows.find((r) => r.id === form.id.trim());

  // the package as the preview sees it: model urls of this browser
  const previewPkg = useMemo(() => {
    if (!built.pkg) return null;
    const p = JSON.parse(JSON.stringify(built.pkg)) as { zones: { id: string; scene: string; model?: unknown }[] };
    for (const z of p.zones ?? []) if (z.scene === "glb" && blobs[z.id]) z.model = { url: blobs[z.id], scale: 1, y: 0 };
    const r = EnvironmentPackage.safeParse(p);
    return r.success ? r.data : null;
  }, [built, blobs]);
  const zodIssue = useMemo(() => { if (!built.pkg) return built.error ?? null; const p = JSON.parse(JSON.stringify(built.pkg)) as { zones: { scene: string; model?: unknown }[] }; for (const z of p.zones ?? []) if (z.scene === "glb" && !z.model) z.model = { url: "https://x.test/a.glb", scale: 1, y: 0 }; const r = EnvironmentPackage.safeParse(p); return r.success ? null : `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}`; }, [built]);

  async function pickFile(zone: string, f: File | null) {
    setBlobs((b) => { if (b[zone]) URL.revokeObjectURL(b[zone]); const n = { ...b }; delete n[zone]; if (f) n[zone] = URL.createObjectURL(f); return n; });
    setFiles((o) => { const n = { ...o }; if (f) n[zone] = f; else delete n[zone]; return n; });
    setReports((o) => { const n = { ...o }; delete n[zone]; return n; });
    if (f) { const rep = checkGlb(new Uint8Array(await f.arrayBuffer())); setReports((o) => ({ ...o, [zone]: rep })); }
  }
  function addAt(kind: "hotspot" | "station") {
    if (!picked) return;
    try {
      const key = kind === "hotspot" ? "hotspots" : "stations";
      const list = JSON.parse(form[key] || "[]") as unknown[];
      const zone = (JSON.parse(form.zones) as { id: string }[])[0]?.id ?? "praca";
      const n = list.length + 1;
      list.push(kind === "hotspot"
        ? { id: `ponto${n}`, zone, label: "Novo ponto", text: "Descreva o que este ponto mostra, com a fonte.", refs: [], at: [picked.x, 1.5, picked.z], radius: 3 }
        : { id: `estacao${n}`, title: "Nova estação", at: [picked.x, picked.z], look: [picked.x - Math.sin(picked.yaw) * 10, picked.z - Math.cos(picked.yaw) * 10], script: "Escreva o que o guia diz aqui. Termine com uma pergunta.", refs: [] });
      setForm((f) => ({ ...f, [key]: JSON.stringify(list, null, 1) }));
    } catch { setMsg({ kind: "err", text: t("env.err.json") }); }
  }
  async function save(status: "draft" | "published") {
    setMsg(null);
    if (!built.pkg || zodIssue) { setMsg({ kind: "err", text: zodIssue ?? t("env.err.json") }); return; }
    const bad = Object.entries(reports).find(([, r]) => !r.ok);
    if (bad) { setMsg({ kind: "err", text: `${bad[0]}: ${bad[1].problems.map((p) => t(`env.problem.${p}` as "env.problem.too_big")).join(", ")}` }); return; }
    setBusy(true);
    try { await saveEnvironment(built.pkg, status, files); setMsg({ kind: "ok", text: status === "published" ? t("env.published") : t("env.saved") }); load(); }
    catch (e) {
      const d = e instanceof ApiError ? e.data : {};
      const problems = Array.isArray(d.problems) ? (d.problems as string[]).map((p) => t(`env.problem.${p}` as "env.problem.too_big")).join(", ") : "";
      setMsg({ kind: "err", text: `${typeof d.error === "string" ? d.error : "generic"}${problems ? `: ${problems}` : ""}${Array.isArray(d.issues) ? `: ${(d.issues as string[])[0]}` : ""}` });
    }
    setBusy(false);
  }
  function edit(r: EnvAdminRow) {
    const p = r.data as { id: string; title: string; era: string; refs: string[]; spawn: number[]; bounds: { min: number[]; max: number[] }; zones: unknown[]; hotspots: unknown[]; stations: unknown[]; sounds: unknown[]; sheet: { summary: string; sources: string[]; uncertainty?: string } };
    setForm({ id: p.id, title: p.title, era: p.era, refs: p.refs.join(", "), spawn: p.spawn.join(", "), bounds: [...p.bounds.min, ...p.bounds.max].join(", "), zones: JSON.stringify(p.zones, null, 1), hotspots: JSON.stringify(p.hotspots, null, 1), stations: JSON.stringify(p.stations, null, 1), sounds: JSON.stringify(p.sounds, null, 1), summary: p.sheet.summary, sources: p.sheet.sources.join("\n"), uncertainty: p.sheet.uncertainty ?? "" });
    setFiles({}); setReports({}); setBlobs({}); setPreview(false);
  }
  async function remove(id: string) { if (!window.confirm(t("env.confirm"))) return; try { await deleteEnvironment(id); load(); } catch { setMsg({ kind: "err", text: t("a3d.err.generic") }); } }

  if (!role) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  if (role !== "admin") return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{t("admin.forbidden")}</p></main>;
  const f = "min-h-10 w-full rounded-control border border-line bg-bg px-3 py-2";
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((s) => ({ ...s, [k]: e.target.value }));
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("env.title")}</h1>
      <p className="text-muted">{t("env.help").replace("{mb}", String(LIMITS.maxBytes / 1e6)).replace("{tri}", String(LIMITS.maxTriangles / 1000)).replace("{tex}", String(LIMITS.maxTexture))}</p>

      <section aria-label={t("env.list")} className="flex flex-col gap-2">
        <h2 className="text-xl">{t("env.list")}</h2>
        {!rows.length && <p className="text-sm text-muted">{t("env.empty")}</p>}
        <ul className="flex flex-col gap-1">{rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-control border border-line p-2 text-sm">
            <span className="flex-1"><strong>{r.title}</strong> <span className="text-muted">· {r.id} · {r.status === "published" ? t("env.status.published") : t("env.status.draft")} · {(r.size_bytes / 1e6).toFixed(1)} MB</span></span>
            <a className="underline" href={`/imersao?e=${r.id}`} target="_blank" rel="noreferrer">{t("env.open")}</a>
            <button type="button" className="underline" onClick={() => edit(r)}>{t("a3d.edit")}</button>
            <button type="button" className="underline" onClick={() => void remove(r.id)}>{t("a3d.delete")}</button>
          </li>))}</ul>
      </section>

      <section aria-label={t("env.form")} className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl">{existing ? t("env.edit") : t("env.new")}</h2><button type="button" className="text-sm underline" onClick={() => { setForm(TEMPLATE); setFiles({}); setReports({}); setBlobs({}); setPreview(false); }}>{t("env.template")}</button></div>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.id")}<input className={f} value={form.id} onChange={set("id")} disabled={!!existing} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.name")}<input className={f} value={form.title} onChange={set("title")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.era")}<input className={f} value={form.era} onChange={set("era")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.refs")}<input className={f} value={form.refs} onChange={set("refs")} placeholder="EXO.27.1, ACT.17.22" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">{t("env.f.spawn")}<input className={f} value={form.spawn} onChange={set("spawn")} /></label>
          <label className="flex flex-col gap-1 text-sm">{t("env.f.bounds")}<input className={f} value={form.bounds} onChange={set("bounds")} /></label>
        </div>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.zones")}<textarea className={`${f} font-mono text-xs`} rows={6} value={form.zones} onChange={set("zones")} /></label>
        {glbZones.map((z) => (
          <div key={z.id} className="flex flex-col gap-1 rounded-control border border-line p-2 text-sm" data-testid={`glb-${z.id}`}>
            <label className="flex flex-col gap-1">{t("env.f.glb").replace("{zone}", z.id)}<input type="file" accept=".glb,model/gltf-binary" onChange={(e) => void pickFile(z.id, e.target.files?.[0] ?? null)} /></label>
            {z.model?.url && !files[z.id] && <span className="text-xs text-muted">{t("env.f.glb.keep")}</span>}
            {reports[z.id] && (
              <p role={reports[z.id].ok ? "status" : "alert"} className="text-xs" data-testid={`report-${z.id}`}>
                {(reports[z.id].bytes / 1e6).toFixed(2)} MB · {reports[z.id].triangles.toLocaleString("pt-BR")} {t("env.triangles")} · {reports[z.id].images.length} {t("env.textures")}
                {reports[z.id].ok ? ` · ${t("env.perf.ok")}` : ` · ${reports[z.id].problems.map((p) => t(`env.problem.${p}` as "env.problem.too_big")).join(", ")}`}
              </p>
            )}
          </div>
        ))}
        <label className="flex flex-col gap-1 text-sm">{t("env.f.hotspots")}<textarea className={`${f} font-mono text-xs`} rows={5} value={form.hotspots} onChange={set("hotspots")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.stations")}<textarea className={`${f} font-mono text-xs`} rows={5} value={form.stations} onChange={set("stations")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.sounds")}<textarea className={`${f} font-mono text-xs`} rows={3} value={form.sounds} onChange={set("sounds")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.summary")}<textarea className={f} rows={3} value={form.summary} onChange={set("summary")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.sources")}<textarea className={f} rows={2} value={form.sources} onChange={set("sources")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("env.f.uncertainty")}<input className={f} value={form.uncertainty} onChange={set("uncertainty")} /></label>
        {zodIssue && <p role="alert" className="text-xs text-muted" data-testid="env-issue">{zodIssue}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" disabled={!previewPkg} onClick={() => setPreview((p) => !p)}>{preview ? t("a3d.preview.hide") : t("a3d.preview")}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void save("draft")}>{t("env.save.draft")}</Button>
          <Button type="button" disabled={busy} onClick={() => void save("published")}>{busy ? t("doc.gap.working") : t("env.publish")}</Button>
        </div>
        {msg && <p role={msg.kind === "err" ? "alert" : "status"} className="text-sm" data-testid="env-msg">{msg.text}</p>}
        {preview && previewPkg && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">{t("env.preview.help")}</p>
            <div className="h-[460px]"><ImmersiveView key={JSON.stringify(previewPkg).length} pkg={previewPkg} onAuthorPick={setPicked} /></div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span data-testid="env-picked">{picked ? `x ${picked.x} · z ${picked.z}` : t("env.pick.none")}</span>
              <Button type="button" variant="ghost" disabled={!picked} onClick={() => addAt("hotspot")}>{t("env.add.hotspot")}</Button>
              <Button type="button" variant="ghost" disabled={!picked} onClick={() => addAt("station")}>{t("env.add.station")}</Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
