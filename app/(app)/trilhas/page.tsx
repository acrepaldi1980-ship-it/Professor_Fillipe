"use client";

// Guided paths (Prompt 2.7): optional, one short step a day led by the teacher, with progress. The open path travels in the query string (?id=)
// so the screen stays exportable for Capacitor.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { completePathDay, getPathDetail, listPaths, startPath, type PathDetail, type PathSummary } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

export default function PathsPage() {
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<PathDetail | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => { void listPaths().then((r) => setPaths(r.paths)).catch(() => setError(true)); }, []);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("id"); if (id) setOpen(id); load(); }, [load]);
  useEffect(() => { if (open) void getPathDetail(open).then(setDetail).catch(() => setError(true)); else setDetail(null); }, [open]);

  async function toggleDone(p: PathDetail, day: number, done: boolean) {
    if (done) return;
    try { await completePathDay(p.id, day); setDetail(await getPathDetail(p.id)); load(); } catch { setError(true); }
  }
  async function begin(p: PathDetail) { try { await startPath(p.id); load(); } catch { setError(true); } }

  if (detail && open) {
    const next = detail.days.find((d) => !d.done);
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
        <button type="button" className="self-start text-sm underline" onClick={() => { setOpen(null); window.history.replaceState(null, "", "/trilhas"); }}>{t("paths.back")}</button>
        <h1 className="text-3xl">{detail.title}</h1>
        <p className="text-muted">{detail.description}</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={detail.total} aria-valuenow={detail.done} aria-label={t("paths.progress")} className="h-2 w-full rounded bg-line"><div className="h-2 rounded bg-primary" style={{ width: `${(detail.done / detail.total) * 100}%` }} /></div>
        <p className="text-sm text-muted">{t("paths.progress.n").replace("{done}", String(detail.done)).replace("{total}", String(detail.total))}{detail.completed ? ` · ${t("paths.completed")}` : ""}</p>
        {next && <Link href={`/estudo?trilha=${detail.id}&dia=${next.day}`} onClick={() => void begin(detail)} className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-5 font-semibold text-primary-ink">{detail.done ? t("paths.continue") : t("paths.begin")} · {t("paths.day").replace("{n}", String(next.day))}</Link>}
        <ol className="flex flex-col gap-2">
          {detail.days.map((d) => (
            <li key={d.day} className={`rounded-control border p-3 ${d.done ? "border-line bg-bg" : "border-line bg-surface"}`} data-testid="path-day">
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={d.done} disabled={d.done} onChange={() => void toggleDone(detail, d.day, d.done)} aria-label={`${t("paths.mark")} ${d.day}`} className="mt-1" />
                <div className="flex-1"><strong>{t("paths.day").replace("{n}", String(d.day))}: {d.title}</strong><p className="text-sm text-muted">{d.goal}</p><p className="text-xs text-muted">{formatRefPt(d.ref.split("-")[0])}{d.ref.includes("-") ? ` – ${formatRefPt(d.ref.split("-")[1])}` : ""}</p></div>
                <Link href={`/estudo?trilha=${detail.id}&dia=${d.day}`} onClick={() => void begin(detail)} className="text-sm underline">{t("paths.study")}</Link>
              </div>
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="text-sm">{t("paths.error")}</p>}
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("paths.title")}</h1>
      <p className="text-muted">{t("paths.help")}</p>
      {error && <p role="alert" className="text-sm">{t("paths.error")}</p>}
      <ul className="flex flex-col gap-3">
        {paths.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => { setOpen(p.id); window.history.replaceState(null, "", `/trilhas?id=${p.id}`); }} className="w-full rounded-control border border-line bg-surface p-4 text-left">
              <strong className="text-lg">{p.title}</strong>
              <span className="block text-sm text-muted">{p.description}</span>
              <span className="mt-1 block text-xs text-muted">{p.total} {t("paths.days")} · {p.completed ? t("paths.completed") : p.started ? t("paths.progress.n").replace("{done}", String(p.done)).replace("{total}", String(p.total)) : t("paths.notstarted")}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
