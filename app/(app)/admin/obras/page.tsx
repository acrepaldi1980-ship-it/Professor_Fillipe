"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminSetWork, adminWorks, type AdminWork } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function WorksAdmin() {
  const [works, setWorks] = useState<AdminWork[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState(false);
  const load = () => adminWorks().then((r) => setWorks(r.works)).catch(() => setErr(true));
  useEffect(() => { void load(); }, []);
  const shown = useMemo(() => (works ?? []).filter((w) => !q || `${w.title} ${w.authors.join(" ")} ${w.kind} ${w.tradition} ${w.license}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200), [works, q]);
  if (err) return <main className="p-6"><p role="alert">{t("admin.forbidden")}</p></main>;
  if (!works) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.works.title")}</h1>
      <input type="search" className="h-11 rounded-control border border-line bg-surface px-3" placeholder={t("admin.works.search")} aria-label={t("admin.works.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="text-sm text-muted">{works.length} · {works.filter((w) => w.enabled).length} {t("admin.works.enabled").toLowerCase()}</p>
      <ul className="flex flex-col gap-2">
        {shown.map((w) => (
          <li key={w.id}>
            <Card className="flex flex-col gap-1">
              <strong>{w.title}</strong>
              <span className="text-sm text-muted">{w.authors.join(", ")} · {w.kind} · {w.tradition} · {w.license} · {t("admin.works.chunks").replace("{n}", String(w.chunk_count))}</span>
              <div className="flex items-center gap-2 text-sm">
                <span className={w.enabled ? "text-primary" : "text-muted"}>{w.enabled ? t("admin.works.enabled") : t("admin.works.disabled")}</span>
                <Button type="button" variant="ghost" className="text-sm" disabled={w.review_status !== "approved"} onClick={() => void adminSetWork(w.id, !w.enabled).then(load)}>{w.enabled ? t("admin.works.disable") : t("admin.works.enable")}</Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
