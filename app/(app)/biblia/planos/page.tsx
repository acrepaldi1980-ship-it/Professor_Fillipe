"use client";

// Reading plans (spec 8.24, RF-M24-03): my plans with today's reading, the catalog, and a plan of the student's own.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { deleteReadingPlan, getReadingPlan, getReadingPlans, pausePlan, setPlanDay, startReadingPlan, type CatalogPlanInfo, type MyPlan, type PlanDetail } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { BOOKS } from "@/lib/knowledge/books";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const field = "min-h-11 rounded-control border border-line bg-surface px-2 text-base text-ink";

export default function PlansPage() {
  const [catalog, setCatalog] = useState<CatalogPlanInfo[]>([]);
  const [mine, setMine] = useState<MyPlan[] | null>(null);
  const [detail, setDetail] = useState<Record<string, PlanDetail>>({});
  const [error, setError] = useState(false);
  const [custom, setCustom] = useState({ from: "MAT", to: "JHN", days: 30 });

  const load = useCallback(async () => {
    try {
      const r = await getReadingPlans();
      setCatalog(r.catalog); setMine(r.mine);
      const d = await Promise.all(r.mine.map((p) => getReadingPlan(p.id).then((x) => x.plan)));
      setDetail(Object.fromEntries(d.map((p) => [p.id, p])));
    } catch { setError(true); setMine((m) => m ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const start = (b: Parameters<typeof startReadingPlan>[0]) => startReadingPlan(b).then(load).catch(() => setError(true));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <Link href="/biblia" className="text-sm underline">← {t("plans.back")}</Link>
      <h1 className="text-3xl">{t("plans.title")}</h1>
      {error && <Toast>{t("reader.error")}</Toast>}

      <section aria-labelledby="mine" className="flex flex-col gap-2">
        <h2 id="mine" className="text-xl">{t("plans.mine")}</h2>
        {mine === null ? <p className="text-muted">{t("common.loading")}</p> : mine.length === 0 ? <p className="text-muted">{t("plans.empty")}</p> : mine.map((p) => {
          const d = detail[p.id];
          const s = p.status;
          const nextDay = s.nextDay;
          const dayToRead = s.finished ? null : nextDay;
          const chapters = d && dayToRead ? d.schedule.find((x) => x.day === dayToRead)?.chapters ?? [] : [];
          return (
            <Card key={p.id} className="flex flex-col gap-2" data-testid="my-plan">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{p.name}</strong><span className="text-sm text-muted">{p.paused ? t("plans.paused") : s.finished ? t("plans.finished") : s.today < 1 ? t("plans.upcoming").replace("{n}", String(1 - s.today)) : s.behind > 0 ? t("plans.behind").replace("{n}", String(s.behind)) : t("plans.ontrack")}</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-primary" style={{ width: `${s.percent}%` }} /></div>
              <p className="text-sm text-muted">{t("plans.day").replace("{n}", String(Math.min(s.done + 1, s.total))).replace("{total}", String(s.total))} · {s.percent}%</p>
              {dayToRead && chapters.length > 0 && (
                <div>
                  <p className="text-sm font-semibold">{t("plans.next").replace("{n}", String(dayToRead))}</p>
                  <p className="text-sm text-muted">{chapters.map(formatRefPt).join(" · ")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-ink" href={`/biblia?r=${chapters[0]}&plan=${p.id}&day=${dayToRead}`}>{t("plans.read")}</Link>
                    <Button type="button" variant="ghost" onClick={() => void setPlanDay(p.id, dayToRead, true).then(load)}>{t("plans.done")}</Button>
                    {d && d.done_days.length > 0 && <Button type="button" variant="ghost" onClick={() => void setPlanDay(p.id, Math.max(...d.done_days), false).then(load)}>{t("plans.undo")}</Button>}
                  </div>
                </div>
              )}
              <div className="flex gap-3 text-sm">
                <button type="button" className="underline" onClick={() => void pausePlan(p.id, !p.paused).then(load)}>{t(p.paused ? "plans.resume" : "plans.pause")}</button>
                <button type="button" className="underline" onClick={() => { if (window.confirm(t("plans.confirm.delete"))) void deleteReadingPlan(p.id).then(load); }}>{t("plans.delete")}</button>
              </div>
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="cat" className="flex flex-col gap-2">
        <h2 id="cat" className="text-xl">{t("plans.catalog")}</h2>
        {catalog.map((c) => (
          <Card key={c.key} className="flex flex-col gap-1">
            <strong>{c.name}</strong>
            <p className="text-sm text-muted">{c.description} ({t("plans.days").replace("{n}", String(c.days))})</p>
            <Button type="button" className="self-start" onClick={() => void start({ key: c.key })}>{t("plans.start")}</Button>
          </Card>
        ))}
        <Card className="flex flex-col gap-2">
          <strong>{t("plans.custom")}</strong>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void start({ key: "custom", custom }); }}>
            <label className="flex flex-col text-sm">{t("plans.custom.from")}<select className={field} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })}>{BOOKS.map((b) => <option key={b.code} value={b.code}>{b.pt}</option>)}</select></label>
            <label className="flex flex-col text-sm">{t("plans.custom.to")}<select className={field} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })}>{BOOKS.map((b) => <option key={b.code} value={b.code}>{b.pt}</option>)}</select></label>
            <label className="flex flex-col text-sm">{t("plans.custom.days")}<input className={`${field} w-24`} type="number" min={1} max={1200} value={custom.days} onChange={(e) => setCustom({ ...custom, days: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <Button type="submit" disabled={BOOKS.findIndex((b) => b.code === custom.to) < BOOKS.findIndex((b) => b.code === custom.from)}>{t("plans.custom.start")}</Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
