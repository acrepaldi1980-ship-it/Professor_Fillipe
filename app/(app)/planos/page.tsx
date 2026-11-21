"use client";

// Plan comparison and checkout (J07, spec 8.12): choose the plan, the cycle and the way to pay; the provider's page finishes the payment.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { getMe, getMySubscription, getPlans, startCheckout, type MySubscription, type PlanInfo } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";

const brl = (n: number | string) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function features(p: PlanInfo): string[] {
  const l = p.limits, f = p.features;
  const out: string[] = [];
  out.push(t("plans.feat.voice").replace("{n}", String(l.voice_minutes_day ?? 0)));
  out.push(l.text_messages_day == null ? t("plans.feat.text.unlimited") : t("plans.feat.text").replace("{n}", String(l.text_messages_day)));
  out.push(l.lessons_month == null ? t("plans.feat.lesson.unlimited") : t("plans.feat.lesson").replace("{n}", String(l.lessons_month)));
  if (f.sermon) out.push(t("plans.feat.sermon"));
  out.push(f.deepen === "full" ? t("plans.feat.deepen.full") : l.deepen_month != null ? t("plans.feat.deepen").replace("{n}", String(l.deepen_month)) : t("plans.feat.deepen.basic"));
  out.push(t("plans.feat.illus").replace("{n}", String(l.illustrations_day ?? 0)));
  if (f.pdf_export) out.push(t("plans.feat.pdf"));
  out.push(t("plans.feat.study"));
  return out;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [cycle, setCycle] = useState<"month" | "year">("month");
  const [method, setMethod] = useState<"pix" | "card" | "boleto">("pix");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minor, setMinor] = useState(false);

  useEffect(() => {
    void getPlans().then((r) => setPlans(r.plans)).catch(() => undefined);
    void getMySubscription().then(setMine).catch(() => undefined);
    void getMe().then((m) => setMinor(!!m.profile?.is_minor)).catch(() => undefined);
  }, []);

  async function choose(plan: "plus" | "premium") {
    setBusy(plan); setError(null);
    try {
      const r = await startCheckout(plan, cycle, method);
      // the test checkout is a screen of the app; a real provider's page opens through the platform layer (web checkout now, store purchase later)
      if (r.checkoutUrl.startsWith("/")) router.push(r.checkoutUrl); else await getPlatform().purchases.openCheckout(r.checkoutUrl);
    } catch (e) {
      const m = (e as Error).message;
      setError(m === "api_error_403" ? t("plans.minor") : t("consent.error"));
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("plans.title")}</h1>
      <p className="text-muted">{t("plans.help")}</p>
      {minor && <p role="note" data-testid="minor-note" className="rounded-control border border-line p-3">{t("plans.minor")}</p>}
      <div role="radiogroup" aria-label={t("plans.cycle.month")} className="flex gap-2">
        {(["month", "year"] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={cycle === c} className={`min-h-11 flex-1 rounded-control border px-3 ${cycle === c ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => setCycle(c)}>{t(`plans.cycle.${c}`)}</button>)}
      </div>
      <div role="radiogroup" aria-label={t("plans.method")} className="flex gap-2">
        {(["pix", "card", "boleto"] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} className={`min-h-11 flex-1 rounded-control border px-3 ${method === m ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => setMethod(m)}>{t(`plans.method.${m}`)}</button>)}
      </div>
      {error && <Toast>{error}</Toast>}
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const current = mine?.plan === p.id;
          const trial = p.id === "premium" && mine?.trialEligible && Number(p.features.trial_days ?? 0) > 0;
          return (
            <Card key={p.id} className={`flex flex-col gap-2 ${current ? "ring-2 ring-primary" : ""}`}>
              <h2 className="text-xl">{p.name}</h2>
              <p className="text-2xl font-semibold">{p.id === "free" ? t("plans.free") : cycle === "year" && p.price_year ? t("plans.price.year").replace("{p}", brl(p.price_year)) : t("plans.price.month").replace("{p}", brl(p.price_month))}</p>
              {trial && <p className="rounded-control bg-surface px-2 py-1 text-sm">{t("plans.trial")}</p>}
              <ul className="flex flex-col gap-1 text-sm">{features(p).map((x) => <li key={x}>✓ {x}</li>)}</ul>
              {current ? <p className="mt-auto text-sm text-muted">{t("plans.current")}</p> : p.id !== "free" && <Button type="button" className="mt-auto" disabled={busy !== null || minor} onClick={() => void choose(p.id as "plus" | "premium")}>{trial ? t("plans.trial") : t("plans.choose")}</Button>}
              {trial && !current && <p className="text-xs text-muted">{t("plans.trial.note").replace("{p}", brl(p.price_month))}</p>}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
