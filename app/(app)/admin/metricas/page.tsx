"use client";

// Dashboard indicators of spec 15.2.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { adminMetrics, type AdminMetrics } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const pct = (v: number | null | undefined) => (v == null ? t("admin.metrics.none") : `${v}%`);
const brl = (n: number) => `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Stat = ({ label, value }: { label: string; value: string | number }) => <Card><div className="text-sm text-muted">{label}</div><div className="text-2xl">{value}</div></Card>;

export default function MetricsAdmin() {
  const [m, setM] = useState<AdminMetrics | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void adminMetrics().then(setM).catch(() => setErr(true)); }, []);
  if (err) return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{t("admin.forbidden")}</p></main>;
  if (!m) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  const lat = m.voice_latency_ms;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.metrics.title")}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t("admin.metrics.dau")} value={m.dau} />
        <Stat label={t("admin.metrics.mau")} value={m.mau} />
        <Stat label={t("admin.metrics.interview")} value={pct(m.interview_completion)} />
        <Stat label={t("admin.metrics.sessions")} value={m.sessions_per_user_week} />
        <Stat label={t("admin.metrics.retention")} value={`${pct(m.retention.d1)} / ${pct(m.retention.d7)} / ${pct(m.retention.d30)}`} />
        <Stat label={t("admin.metrics.conversion")} value={pct(m.conversion_pct)} />
        <Stat label={t("admin.billing.mrr")} value={brl(m.billing.mrr_brl)} />
        <Stat label={t("admin.billing.canceled")} value={m.billing.canceled_30d} />
        <Stat label={t("admin.billing.cost")} value={brl(m.billing.ai_cost_30d_brl)} />
        <Stat label={t("admin.metrics.latency")} value={lat ? `${Math.round(lat.median)} / ${Math.round(lat.p95)} ms` : t("admin.metrics.none")} />
        <Stat label={t("admin.metrics.flagged")} value={`${pct(m.flagged_rate_pct)} (${m.flags_open})`} />
        <Stat label={t("admin.metrics.eval")} value={m.last_eval ? Object.entries(m.last_eval.summary).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ") : t("admin.metrics.none")} />
      </div>
      <Card>
        <h2 className="mb-1 text-lg">{t("admin.llm.title")}</h2>
        <p className="mb-2 text-xs text-muted">{t("admin.llm.help")}</p>
        {(m.llm?.endpoints ?? []).length === 0 ? <p className="text-sm text-muted">{t("admin.llm.none")}</p> : (
          <ul className="text-sm">{(m.llm?.endpoints ?? []).map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-x-3"><span className="font-mono text-xs">{e.id}</span><span>{e.ok}/{e.calls} ok · 429: {e.rate_limited + e.quota} · {e.avg_ms} ms</span></li>)}</ul>
        )}
        {(m.llm?.cooling ?? []).length > 0 && <p className="mt-2 text-sm"><strong>{t("admin.llm.cooling")}:</strong> {(m.llm?.cooling ?? []).map((c) => `${c.id} (${c.seconds}s, ${c.reason})`).join("; ")}</p>}
      </Card>
      <Card>
        <h2 className="mb-1 text-lg">{t("admin.metrics.errors")}</h2>
        {(m.errors_24h ?? []).length === 0 ? <p className="text-sm text-muted">{t("admin.metrics.errors.none")}</p> : <ul className="text-sm">{(m.errors_24h ?? []).map((e) => <li key={e.route + e.code} className="flex justify-between"><span>{e.route} · {e.code}</span><span>{e.n}</span></li>)}</ul>}
      </Card>
      <Card><h2 className="mb-1 text-lg">{t("admin.metrics.events")}</h2><ul className="text-sm">{m.events_7d.map((e) => <li key={e.event} className="flex justify-between"><span>{e.event}</span><span>{e.n}</span></li>)}</ul></Card>
    </main>
  );
}
