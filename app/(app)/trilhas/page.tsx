"use client";

// Guided paths (Prompt 2.7): optional, one short step a day led by the teacher, with progress. The open path travels in the query string (?id=)
// so the screen stays exportable for Capacitor.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { completePathDay, createPersonalPath, getMe, getPathDetail, listPaths, startPath, type PathDetail, type PathSummary, type PersonalPathInput } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

export default function PathsPage() {
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<PathDetail | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(false);
  const [input, setInput] = useState<PersonalPathInput>({ goal: "know_jesus", role: "student", level: 2, minutes: 15, days: 30 });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { void listPaths().then((r) => setPaths(r.paths)).catch(() => setError(true)); }, []);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("id"); if (id) setOpen(id); load(); }, [load]);
  useEffect(() => { if (open) void getPathDetail(open).then(setDetail).catch(() => setError(true)); else setDetail(null); }, [open]);

  async function toggleDone(p: PathDetail, day: number, done: boolean) {
    if (done) return;
    try { await completePathDay(p.id, day); setDetail(await getPathDetail(p.id)); load(); } catch { setError(true); }
  }
  useEffect(() => { void getMe().then((m) => { const mins = m.profile?.daily_minutes; const lv = m.profile?.level_score; setInput((i) => ({ ...i, minutes: mins && mins >= 5 ? Math.min(60, mins) : i.minutes, level: lv != null ? Math.min(5, Math.max(1, Math.round(lv / 20) || 1)) : i.level })); }).catch(() => undefined); }, []);
  async function make() {
    setBusy(true);
    try { const r = await createPersonalPath(input); setForm(false); setDetail(null); setOpen(r.id); window.history.replaceState(null, "", `/trilhas?id=${r.id}`); load(); setDetail(await getPathDetail(r.id)); } catch { setError(true); } finally { setBusy(false); }
  }
  async function begin(p: PathDetail) { try { await startPath(p.id); load(); } catch { setError(true); } }

  if (detail && open) {
    const next = detail.days.find((d) => !d.done);
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
        <button type="button" className="self-start text-sm underline" onClick={() => { setOpen(null); window.history.replaceState(null, "", "/trilhas"); }}>{t("paths.back")}</button>
        <h1 className="text-3xl">{detail.title}</h1>
        <p className="text-muted">{detail.description}</p>
        {detail.promise && <p className="text-sm"><strong>{t("paths.promise")}:</strong> {detail.promise}</p>}
        {detail.personal && <button type="button" className="self-start text-sm underline" onClick={() => { setOpen(null); setForm(true); window.history.replaceState(null, "", "/trilhas"); }}>{t("paths.mine.remake")}</button>}
        <div role="progressbar" aria-valuemin={0} aria-valuemax={detail.total} aria-valuenow={detail.done} aria-label={t("paths.progress")} className="h-2 w-full rounded bg-line"><div className="h-2 rounded bg-primary" style={{ width: `${(detail.done / detail.total) * 100}%` }} /></div>
        <p className="text-sm text-muted">{t("paths.progress.n").replace("{done}", String(detail.done)).replace("{total}", String(detail.total))}{detail.completed ? ` · ${t("paths.completed")}` : ""}</p>
        {next && <Link href={`/estudo?trilha=${detail.id}&dia=${next.day}`} onClick={() => void begin(detail)} className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-5 font-semibold text-primary-ink">{detail.done ? t("paths.continue") : t("paths.begin")} · {t("paths.day").replace("{n}", String(next.day))}</Link>}
        <ol className="flex flex-col gap-2">
          {detail.days.map((d, i) => (
            <li key={d.day} className={`rounded-control border p-3 ${d.done ? "border-line bg-bg" : "border-line bg-surface"}`} data-testid={d.kind === "review" ? "path-review" : "path-day"}>
              {d.week && detail.days[i - 1]?.week !== d.week && (() => { const w = detail.weeks?.find((x) => x.week === d.week); return <p className="mb-1 text-xs font-semibold uppercase text-muted">{t("paths.week").replace("{n}", String(d.week))}{w ? ` · ${w.theme}` : ""}{w && w.extra !== "none" ? ` · ${t(`paths.extra.${w.extra}`)}` : ""}</p>; })()}
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={d.done} disabled={d.done} onChange={() => void toggleDone(detail, d.day, d.done)} aria-label={`${t("paths.mark")} ${d.day}`} className="mt-1" />
                <div className="flex-1"><strong>{t("paths.day").replace("{n}", String(d.day))}: {d.title}</strong><p className="text-sm text-muted">{d.goal}</p>{d.question && <p className="text-sm"><em>{t("paths.question")}:</em> {d.question}</p>}{d.action && <p className="text-sm text-muted"><em>{t("paths.action")}:</em> {d.action}</p>}<p className="text-xs text-muted">{formatRefPt(d.ref.split("-")[0])}{d.ref.includes("-") ? ` – ${formatRefPt(d.ref.split("-")[1])}` : ""}</p></div>
                <Link href={`/estudo?trilha=${detail.id}&dia=${d.day}`} onClick={() => void begin(detail)} className="text-sm underline">{t("paths.study")}</Link>
              </div>
            </li>
          ))}
        </ol>
        {detail.adjust && <p className="text-sm text-muted"><strong>{t("paths.adjust")}:</strong> {detail.adjust}</p>}
        {error && <p role="alert" className="text-sm">{t("paths.error")}</p>}
      </main>
    );
  }
  const sel = "min-h-11 w-full rounded-control border border-line bg-surface px-3";
  if (form) {
    const goals = ["know_jesus", "whole_bible", "understand_book", "intimacy", "overcome", "prepare", "theology"] as const;
    const roles = ["student", "ebd_teacher", "theology_student", "pastor", "new_convert", "seeking"] as const;
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24" data-testid="path-form">
        <button type="button" className="self-start text-sm underline" onClick={() => setForm(false)}>{t("paths.back")}</button>
        <h1 className="text-3xl">{t("paths.mine")}</h1>
        <p className="text-muted">{t("paths.mine.help")}</p>
        <label className="flex flex-col gap-1 text-sm">{t("paths.mine.goal")}<select className={sel} value={input.goal} onChange={(e) => setInput({ ...input, goal: e.target.value as PersonalPathInput["goal"] })}>{goals.map((g) => <option key={g} value={g}>{t(`paths.goal.${g}`)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t("paths.mine.role")}<select className={sel} value={input.role} onChange={(e) => setInput({ ...input, role: e.target.value as PersonalPathInput["role"] })}>{roles.map((r) => <option key={r} value={r}>{t(`paths.role.${r}`)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t("paths.mine.level")}<select className={sel} value={input.level} onChange={(e) => setInput({ ...input, level: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t("paths.mine.minutes")}<select className={sel} value={input.minutes} onChange={(e) => setInput({ ...input, minutes: Number(e.target.value) })}>{[5, 10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">{t("paths.mine.length")}<select className={sel} value={input.days} onChange={(e) => setInput({ ...input, days: Number(e.target.value) as 14 | 30 | 60 })}>{[14, 30, 60].map((n) => <option key={n} value={n}>{n} {t("paths.days")}</option>)}</select></label>
        <p className="text-xs text-muted">{paths.some((p) => p.personal) ? t("paths.mine.remake.help") : ""}</p>
        <button type="button" disabled={busy} onClick={() => void make()} className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-5 font-semibold text-primary-ink">{t("paths.mine.go")}</button>
        {error && <p role="alert" className="text-sm">{t("paths.error")}</p>}
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("paths.title")}</h1>
      <p className="text-muted">{t("paths.help")}</p>
      {error && <p role="alert" className="text-sm">{t("paths.error")}</p>}
      {!paths.some((p) => p.personal) && <button type="button" onClick={() => setForm(true)} className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-5 font-semibold text-primary-ink" data-testid="path-make">{t("paths.mine.make")}</button>}
      <ul className="flex flex-col gap-3">
        {paths.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => { setOpen(p.id); window.history.replaceState(null, "", `/trilhas?id=${p.id}`); }} className="w-full rounded-control border border-line bg-surface p-4 text-left">
              <strong className="text-lg">{p.personal ? `${t("paths.mine")}: ` : ""}{p.title}</strong>
              <span className="block text-sm text-muted">{p.description}</span>
              <span className="mt-1 block text-xs text-muted">{p.total} {t("paths.days")} · {p.completed ? t("paths.completed") : p.started ? t("paths.progress.n").replace("{done}", String(p.done)).replace("{total}", String(p.total)) : t("paths.notstarted")}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
