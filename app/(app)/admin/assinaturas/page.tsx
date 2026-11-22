"use client";

// Admin: subscribers by plan, recurring revenue, cancellations and AI cost per user.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { getBillingAdmin, type BillingAdmin } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const brl = (n: number) => `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BillingAdminPage() {
  const [d, setD] = useState<BillingAdmin | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void getBillingAdmin().then(setD).catch(() => setErr(true)); }, []);
  if (err) return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{t("admin.forbidden")}</p></main>;
  if (!d) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.billing.title")}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Card><div className="text-sm text-muted">{t("admin.billing.mrr")}</div><div className="text-2xl">{brl(d.mrr_brl)}</div></Card>
        <Card><div className="text-sm text-muted">{t("admin.billing.users")}</div><div className="text-2xl">{d.users}</div></Card>
        <Card><div className="text-sm text-muted">{t("admin.billing.canceled")}</div><div className="text-2xl">{d.canceled_30d}</div></Card>
        <Card><div className="text-sm text-muted">{t("admin.billing.cost")}</div><div className="text-2xl">{brl(d.ai_cost_30d_brl)}</div></Card>
      </div>
      <Card><h2 className="mb-1 text-lg">{t("admin.billing.byplan")}</h2><ul className="text-sm">{d.by_plan_status.map((r) => <li key={`${r.plan_id}${r.status}`} className="flex justify-between"><span>{r.plan_id} · {r.status}</span><span>{r.n}</span></li>)}</ul></Card>
      <Card><h2 className="mb-1 text-lg">{t("admin.billing.peruser")}</h2><ul className="text-sm">{d.ai_cost_per_user.map((r) => <li key={r.user_id} className="flex justify-between"><span>{r.user_id.slice(0, 8)} · {r.messages} msgs</span><span>{brl(r.cost)}</span></li>)}</ul></Card>
    </main>
  );
}
