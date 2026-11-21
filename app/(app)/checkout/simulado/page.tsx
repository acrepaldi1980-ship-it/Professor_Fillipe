"use client";

// Test payment (sandbox, no real money): sends the webhooks a real provider would send, for the student's own subscription.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { simulatePayment } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function SimulatedCheckout() {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
  if (!q) return null;
  const ref = q.get("ref") ?? "";
  async function send(event: "PAYMENT_CONFIRMED" | "PAYMENT_OVERDUE" | "SUBSCRIPTION_DELETED") {
    setBusy(true);
    try { setDone((await simulatePayment(ref, event)).result); } catch { setDone("error"); }
    setBusy(false);
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-4 pb-24">
      <h1 className="text-2xl">{t("checkout.sim.title")}</h1>
      <p className="text-sm text-muted">{t("checkout.sim.help")}</p>
      <Card>
        <p>{t("checkout.sim.amount")}: <strong>R$ {Number(q.get("amount") ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> ({t(`plans.method.${(q.get("method") ?? "pix") as "pix"}`)}) {q.get("trial") === "1" ? `· ${t("plans.trial")}` : ""}</p>
      </Card>
      <Button type="button" disabled={busy} onClick={() => void send("PAYMENT_CONFIRMED")}>{t("checkout.sim.pay")}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void send("PAYMENT_OVERDUE")}>{t("checkout.sim.overdue")}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void send("SUBSCRIPTION_DELETED")}>{t("checkout.sim.cancel")}</Button>
      {done && <p role="status" className="rounded-control bg-surface p-2">{t("checkout.sim.done")} ({done}) <Link className="underline" href="/assinatura">{t("account.sub")}</Link></p>}
    </main>
  );
}
