"use client";

// Flagged answers and the 1% audit sample: the reviewer sees the question and the answer only, and decides correct or incorrect.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminFlags, adminReviewFlag, type AdminFlag } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function FlagsAdmin() {
  const [status, setStatus] = useState("open");
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState(false);
  const load = (s = status) => adminFlags(s).then((r) => setFlags(r.flags)).catch(() => setErr(true));
  useEffect(() => { void adminFlags(status).then((r) => setFlags(r.flags)).catch(() => setErr(true)); }, [status]);
  if (err) return <main className="p-6"><h1 className="text-2xl">{t("admin.hub.title")}</h1><p role="alert">{t("admin.forbidden")}</p></main>;
  const decide = (f: AdminFlag, s: "correct" | "incorrect") => adminReviewFlag(f.flag_id, s, notes[f.flag_id] ?? f.reviewer_note ?? "").then(() => load());
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.flags.title")}</h1>
      <div className="flex gap-2">
        {(["open", "all"] as const).map((s) => <button key={s} type="button" aria-pressed={status === s} className={`min-h-9 rounded-control border px-3 text-sm ${status === s ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => setStatus(s)}>{t(`admin.flags.${s}`)}</button>)}
      </div>
      {!flags ? <p className="text-muted">{t("common.loading")}</p> : flags.length === 0 ? <p className="text-muted">{t("admin.flags.empty")}</p> : (
        <ul className="flex flex-col gap-3">
          {flags.map((f) => (
            <li key={f.flag_id}>
              <Card className="flex flex-col gap-2">
                <div className="text-xs text-muted">{new Date(f.created_at).toLocaleString("pt-BR")} · {f.audit_sample ? t("admin.flags.audit") : `${t("admin.flags.reason")}: ${f.reason ?? "—"}`} · {f.status}</div>
                {f.question && <p className="text-sm"><strong>{t("admin.flags.question")}:</strong> {f.question}</p>}
                <p className="whitespace-pre-line text-sm"><strong>{t("admin.flags.answer")}:</strong> {f.answer}</p>
                <textarea className="min-h-16 rounded-control border border-line bg-surface p-2 text-sm" placeholder={t("admin.flags.note")} aria-label={t("admin.flags.note")} value={notes[f.flag_id] ?? f.reviewer_note ?? ""} onChange={(e) => setNotes({ ...notes, [f.flag_id]: e.target.value })} />
                <div className="flex gap-2"><Button type="button" className="text-sm" onClick={() => void decide(f, "correct")}>{t("admin.flags.correct")}</Button><Button type="button" variant="ghost" className="text-sm" onClick={() => void decide(f, "incorrect")}>{t("admin.flags.incorrect")}</Button></div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
