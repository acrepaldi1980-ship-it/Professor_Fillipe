"use client";

// Admin hub (spec 8.14): every section in one place. Visible to admins; reviewers see only the review screens. The server checks the role on every call.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { getMe } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const SECTIONS = [
  { href: "/admin/obras", k: "works", admin: true }, { href: "/admin/biblioteca", k: "queue", admin: true }, { href: "/admin/notas", k: "notes", admin: false },
  { href: "/admin/respostas", k: "flags", admin: false }, { href: "/admin/usuarios", k: "users", admin: true }, { href: "/admin/assinaturas", k: "billing", admin: true },
  { href: "/admin/metricas", k: "metrics", admin: true }, { href: "/admin/modelos-3d", k: "models3d", admin: true }, { href: "/admin/configuracoes", k: "settings", admin: true }, { href: "/admin/auditoria", k: "audit", admin: true },
] as const;

export default function AdminHub() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { void getMe().then((m) => setRole(m.profile?.role ?? "student")).catch(() => setRole("student")); }, []);
  if (!role) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  if (role !== "admin" && role !== "reviewer") return <main className="p-6"><p role="alert">{t("admin.forbidden")}</p></main>;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.hub.title")}</h1>
      <p className="text-muted">{t("admin.hub.help")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.filter((s) => role === "admin" || !s.admin).map((s) => (
          <Link key={s.href} href={s.href}><Card className="h-full"><strong>{t(`admin.hub.${s.k}` as "admin.hub.works")}</strong><span className="block text-sm text-muted">{t(`admin.hub.${s.k}.help` as "admin.hub.works.help")}</span></Card></Link>
        ))}
      </div>
    </main>
  );
}
