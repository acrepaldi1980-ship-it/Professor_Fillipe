"use client";

// Onboarding step 2: separate, specific consent for sensitive religious data (RF-M02-02, LGPD art. 5º II and 11).
// Declining is fine: theological lens becomes "sem linha definida" and no religious field is stored.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { saveConsent } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function ReligiousConsentPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function choose(granted: boolean) {
    setBusy(true);
    setError(false);
    try {
      await saveConsent("sensitive_religious", granted);
      router.replace("/inicio");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <div className="flex justify-center"><Avatar state="empathetic" size={88} /></div>
      <h1 className="text-center text-3xl">{t("religious.title")}</h1>
      <p>{t("religious.body")}</p>
      <p className="text-muted">{t("religious.use")}</p>
      {error && <Toast>{t("consent.error")}</Toast>}
      <Button type="button" disabled={busy} onClick={() => void choose(true)}>{t("religious.yes")}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void choose(false)}>{t("religious.no")}</Button>
      <p className="text-center text-sm text-muted">{t("religious.no.hint")}</p>
    </main>
  );
}
