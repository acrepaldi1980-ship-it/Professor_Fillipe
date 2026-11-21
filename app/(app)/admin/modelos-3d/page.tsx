"use client";

// Admin: the 3D model catalog (Prompt 2.6). The owner adds a GLB model with its metadata and hotspots without touching the code, previews it
// exactly as the student will see it (tap the model to get the coordinates for a hotspot), and removes or hides it. Admin only.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { adminModels3d, ApiError, deleteModel3d, getMe, saveModel3d, type RemoteModel3D } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { MAX_GLB, ModelMeta } from "@/lib/visuals/model-meta";

const Model3DView = dynamic(() => import("@/components/visuals/Model3DView"), { ssr: false });

const EMPTY = { id: "", name: "", theme: "", alt: "", note: "", refs: "", camera: "4, 3, 6", license: "", sources: "", active: true, hotspots: "[]" };
type Form = typeof EMPTY;
const toForm = (m: RemoteModel3D): Form => ({ id: m.id, name: m.name, theme: m.theme, alt: m.alt, note: m.note, refs: m.refs.join(", "), camera: m.camera.join(", "), license: m.license ?? "", sources: m.sources.join("\n"), active: m.active ?? true, hotspots: JSON.stringify(m.hotspots, null, 1) });

function parse(f: Form): { meta?: ModelMeta; error?: string } {
  let hotspots: unknown;
  try { hotspots = JSON.parse(f.hotspots || "[]"); } catch { return { error: t("a3d.err.hotspots") }; }
  const camera = f.camera.split(",").map((x) => Number(x.trim()));
  const r = ModelMeta.safeParse({ id: f.id.trim(), name: f.name, theme: f.theme, alt: f.alt, note: f.note, refs: f.refs.split(",").map((x) => x.trim()).filter(Boolean), camera, license: f.license, sources: f.sources.split("\n").map((x) => x.trim()).filter(Boolean), active: f.active, hotspots });
  return r.success ? { meta: r.data } : { error: `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}` };
}

export default function ModelsAdminPage() {
  const [role, setRole] = useState<string | null>(null);
  const [models, setModels] = useState<RemoteModel3D[]>([]);
  const [builtin, setBuiltin] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [picked, setPicked] = useState<[number, number, number] | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(() => { void adminModels3d().then((r) => { setModels(r.models); setBuiltin(r.builtin.length); }).catch(() => setMsg({ kind: "err", text: t("admin.error") })); }, []);
  useEffect(() => { void getMe().then((m) => setRole(m.profile?.role ?? "student")).catch(() => setRole("student")); }, []);
  useEffect(() => { if (role === "admin") load(); }, [role, load]);
  useEffect(() => { if (!file) { setBlobUrl(null); return; } const u = URL.createObjectURL(file); setBlobUrl(u); return () => URL.revokeObjectURL(u); }, [file]);

  const parsed = useMemo(() => parse(form), [form]);
  const current = models.find((m) => m.id === form.id);
  const remote: RemoteModel3D | null = useMemo(() => {
    if (!parsed.meta) return null;
    const url = blobUrl ?? current?.file_url ?? null;
    return url ? { ...parsed.meta, note: parsed.meta.note, license: parsed.meta.license, file_url: url, size_bytes: file?.size ?? current?.size_bytes ?? null } : null;
  }, [parsed.meta, blobUrl, current, file]);
  const set = (k: keyof Form) => (e: { target: { value: string; checked?: boolean; type?: string } }) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? !!e.target.checked : e.target.value }));

  function addHotspot() {
    if (!picked) return;
    let list: unknown[] = [];
    try { list = JSON.parse(form.hotspots || "[]"); } catch { setMsg({ kind: "err", text: t("a3d.err.hotspots") }); return; }
    list.push({ id: `ponto${list.length + 1}`, label: "Novo ponto", text: "Descreva o que este ponto mostra.", refs: [], at: picked });
    setForm((f) => ({ ...f, hotspots: JSON.stringify(list, null, 1) }));
  }

  async function save() {
    setMsg(null);
    if (!parsed.meta) { setMsg({ kind: "err", text: parsed.error ?? t("a3d.err.invalid") }); return; }
    if (file && file.size > MAX_GLB) { setMsg({ kind: "err", text: t("a3d.err.big") }); return; }
    setBusy(true);
    try {
      await saveModel3d(parsed.meta, file);
      setMsg({ kind: "ok", text: t("a3d.saved") }); setFile(null); load();
    } catch (e) {
      const code = e instanceof ApiError ? String(e.data.error ?? e.status) : "generic";
      setMsg({ kind: "err", text: t(`a3d.err.${code}` as "a3d.err.generic") === `a3d.err.${code}` ? t("a3d.err.generic") : t(`a3d.err.${code}` as "a3d.err.generic") });
    }
    setBusy(false);
  }
  async function remove(id: string) { if (!window.confirm(t("a3d.confirm"))) return; try { await deleteModel3d(id); if (form.id === id) setForm(EMPTY); load(); } catch { setMsg({ kind: "err", text: t("a3d.err.generic") }); } }

  if (!role) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  if (role !== "admin") return <main className="p-6"><p role="alert">{t("admin.forbidden")}</p></main>;
  const field = "min-h-10 w-full rounded-control border border-line bg-bg px-3 py-2";
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("a3d.title")}</h1>
      <p className="text-muted">{t("a3d.help").replace("{n}", String(builtin))}</p>

      <section aria-label={t("a3d.list")} className="flex flex-col gap-2">
        <h2 className="text-xl">{t("a3d.list")}</h2>
        {!models.length && <p className="text-sm text-muted">{t("a3d.empty")}</p>}
        <ul className="flex flex-col gap-1">{models.map((m) => (
          <li key={m.id} className="flex items-center gap-2 rounded-control border border-line p-2 text-sm">
            <span className="flex-1"><strong>{m.name}</strong> <span className="text-muted">· {m.theme} · {m.size_bytes ? (m.size_bytes / 1e6).toFixed(1) : "?"} MB{m.active === false ? ` · ${t("a3d.hidden")}` : ""}</span></span>
            <button type="button" className="underline" onClick={() => { setForm(toForm(m)); setFile(null); setPreview(false); }}>{t("a3d.edit")}</button>
            <button type="button" className="underline" onClick={() => void remove(m.id)}>{t("a3d.delete")}</button>
          </li>))}</ul>
      </section>

      <section aria-label={t("a3d.form")} className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3">
        <h2 className="text-xl">{current ? t("a3d.edit.title") : t("a3d.new")}</h2>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.id")}<input className={field} value={form.id} onChange={set("id")} disabled={!!current} placeholder="casa_de_pedro" /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.name")}<input className={field} value={form.name} onChange={set("name")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.theme")}<input className={field} value={form.theme} onChange={set("theme")} list="a3d-themes" /><datalist id="a3d-themes">{[...new Set(["Tabernáculo e templo", "Antigo Testamento", "Vida no tempo da Bíblia", "Jesus e os Evangelhos", "Atos e as viagens de Paulo", ...models.map((m) => m.theme)])].map((x) => <option key={x} value={x} />)}</datalist></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.alt")}<textarea className={field} rows={3} value={form.alt} onChange={set("alt")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.note")}<textarea className={field} rows={3} value={form.note} onChange={set("note")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.refs")}<input className={field} value={form.refs} onChange={set("refs")} placeholder="EXO.25.10, JHN.4.6" /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.camera")}<input className={field} value={form.camera} onChange={set("camera")} /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.license")}<input className={field} value={form.license} onChange={set("license")} placeholder="CC0 1.0" /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.sources")}<textarea className={field} rows={2} value={form.sources} onChange={set("sources")} placeholder="https://… (autor, título)" /></label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.file")}<input type="file" accept=".glb,model/gltf-binary" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><span className="text-xs text-muted">{file ? `${file.name} · ${(file.size / 1e6).toFixed(2)} MB` : t("a3d.f.file.help")}</span></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={set("active")} />{t("a3d.f.active")}</label>
        <label className="flex flex-col gap-1 text-sm">{t("a3d.f.hotspots")}<textarea className={`${field} font-mono text-xs`} rows={8} value={form.hotspots} onChange={set("hotspots")} /></label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" disabled={!remote} onClick={() => setPreview((p) => !p)}>{preview ? t("a3d.preview.hide") : t("a3d.preview")}</Button>
          <Button type="button" variant="ghost" disabled={!picked} onClick={addHotspot}>{t("a3d.hotspot.add")}{picked ? ` (${picked.join(", ")})` : ""}</Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? t("doc.gap.working") : t("a3d.save")}</Button>
        </div>
        {!remote && <p className="text-xs text-muted">{parsed.error ?? t("a3d.preview.need")}</p>}
        {msg && <p role={msg.kind === "err" ? "alert" : "status"} className="text-sm">{msg.text}</p>}
        {preview && remote && <div className="h-[420px]"><p className="mb-1 text-xs text-muted">{t("a3d.preview.help")}</p><Model3DView key={`${remote.id}-${remote.file_url}`} modelId={remote.id} remote={remote} onPick={setPicked} /></div>}
      </section>
    </main>
  );
}
