"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminPayments, adminSetRole, adminUsers, type AdminUser } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<{ id: string; rows: { at: string; event_type: string; provider: string }[] } | null>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const load = () => setTick((n) => n + 1);
  useEffect(() => { const h = setTimeout(() => void adminUsers(q).then((r) => setUsers(r.users)).catch(() => setErr(true)), 250); return () => clearTimeout(h); }, [q, tick]);
  if (err) return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{t("admin.forbidden")}</p></main>;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.users.title")}</h1>
      <p className="text-sm text-muted">{t("admin.users.private")}</p>
      <input type="search" className="h-11 rounded-control border border-line bg-surface px-3" placeholder={t("admin.users.search")} aria-label={t("admin.users.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {!users ? <p className="text-muted">{t("common.loading")}</p> : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.user_id}>
              <Card className="flex flex-col gap-1">
                <strong>{u.name ?? "—"} <span className="text-sm font-normal text-muted">{u.email}</span></strong>
                <span className="text-sm text-muted">{t("admin.users.plan")}: {u.plan} ({u.sub_status ?? "—"}) · {t("admin.users.role")}: {u.role} · {u.level ?? "—"} · {t("admin.users.msgs").replace("{n}", String(u.messages_30d))}</span>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Button type="button" variant="ghost" className="text-sm" onClick={() => void adminPayments(u.user_id).then((r) => setPay({ id: u.user_id, rows: r.payments }))}>{t("admin.users.payments")}</Button>
                  {u.role !== "admin" && <Button type="button" variant="ghost" className="text-sm" onClick={() => void adminSetRole(u.user_id, u.role === "reviewer" ? "student" : "reviewer").then(load)}>{u.role === "reviewer" ? t("admin.users.student") : t("admin.users.reviewer")}</Button>}
                </div>
                {pay?.id === u.user_id && <ul className="text-xs text-muted">{pay.rows.length ? pay.rows.map((r, i) => <li key={i}>{new Date(r.at).toLocaleString("pt-BR")} · {r.provider} · {r.event_type}</li>) : <li>—</li>}</ul>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
