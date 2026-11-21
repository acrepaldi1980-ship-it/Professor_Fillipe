"use client";

// "Minha assinatura": plan, situation, next charge, use against the limits, change and cancel.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cancelMySubscription, getMySubscription, type MySubscription } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default function SubscriptionPage() {
  const [me, setMe] = useState<MySubscription | null>(null);
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(() => { void getMySubscription().then(setMe).catch(() => undefined); }, []);
  useEffect(load, [load]);
  if (!me) return <p role="status" className="grid min-h-dvh place-items-center text-muted">{t("common.loading")}</p>;
  const s = me.subscription;
  const u = me.usage, l = me.limits;
  const row = (key: "voice" | "text" | "illus" | "lesson" | "deepen", used: number, limit: number | null | undefined) =>
    <li key={key}>{t(`sub.usage.${key}`).replace("{u}", String(used)).replace("{l}", limit == null ? t("sub.usage.unlimited") : String(limit))}</li>;
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("sub.title")}</h1>
      <Card className="flex flex-col gap-1">
        <p><span className="text-muted">{t("sub.plan")}:</span> <strong>{me.plan === "premium" ? "Premium" : me.plan === "plus" ? "Plus" : "Grátis"}</strong></p>
        {s ? (
          <>
            <p><span className="text-muted">{t("sub.status")}:</span> {t(`sub.status.${s.status}` as "sub.status.active")}</p>
            <p><span className="text-muted">{s.status === "canceled" || s.status === "trialing" ? t("sub.until") : t("sub.next")}:</span> {dt(s.status === "trialing" ? s.trialEnd : s.periodEnd)}</p>
          </>
        ) : <p className="text-muted">{t("sub.none")}</p>}
      </Card>
      <Card className="flex flex-col gap-1">
        <h2 className="text-lg">{t("sub.usage")}</h2>
        <ul className="list-disc pl-5 text-sm">
          {row("voice", u.voice_minutes_day, l.voice_minutes_day)}
          {row("text", u.text_messages_day, l.text_messages_day)}
          {row("illus", u.illustrations_day, l.illustrations_day)}
          {row("lesson", u.lessons_month, l.lessons_month)}
          {row("deepen", u.deepen_month, l.deepen_month)}
        </ul>
      </Card>
      <Link href="/planos" className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-4 text-primary-ink">{s ? t("sub.change") : t("sub.see")}</Link>
      {s && ["trialing", "active", "past_due"].includes(s.status) && (confirming ? (
        <Card className="flex flex-col gap-2"><p>{t("sub.cancel.confirm")}</p><div className="flex gap-2"><Button type="button" onClick={() => void cancelMySubscription().then(() => { setConfirming(false); load(); })}>{t("sub.cancel.yes")}</Button><Button type="button" variant="ghost" onClick={() => setConfirming(false)}>{t("doc.cancel")}</Button></div></Card>
      ) : <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>{t("sub.cancel")}</Button>)}
    </main>
  );
}
