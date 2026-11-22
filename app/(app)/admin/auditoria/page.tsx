"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { adminAudit } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function AuditAdmin() {
  const [rows, setRows] = useState<{ at: string; actor: string | null; action: string; target: string | null }[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void adminAudit().then((r) => setRows(r.entries)).catch(() => setErr(true)); }, []);
  if (err) return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{t("admin.forbidden")}</p></main>;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.audit.title")}</h1>
      <Card>{!rows ? <p className="text-muted">{t("common.loading")}</p> : <ul className="text-sm">{rows.map((r, i) => <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-line py-1"><span>{new Date(r.at).toLocaleString("pt-BR")} · {r.action}</span><span className="text-muted">{r.target} · {r.actor?.slice(0, 8)}</span></li>)}</ul>}</Card>
    </main>
  );
}
