"use client";

// Onboarding step 1: name, birth date (age rules RN-09 / D-08), terms and privacy (RF-M02-01).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { saveConsent, saveMe } from "@/lib/api-client";
import { ageStatus } from "@/lib/auth/age";
import { t } from "@/lib/i18n";

export default function ConsentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = birth ? ageStatus(birth) : "invalid";
  const needsGuardian = status === "minor_needs_guardian";
  const canSubmit = !!name.trim() && (status === "adult" || (needsGuardian && guardian)) && terms && privacy && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveMe({ display_name: name.trim(), preferred_name: name.trim(), birth_date: birth, guardian_ack: needsGuardian ? guardian : undefined });
      await saveConsent("terms", true);
      await saveConsent("privacy", true);
      if (needsGuardian) await saveConsent("guardian_ack", true);
      router.replace("/onboarding/dado-religioso");
    } catch {
      setError(t("consent.error"));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl">{t("consent.title")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="name" label={t("consent.name")} required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        <div className="flex flex-col gap-1">
          <Field id="birth" type="date" label={t("consent.birth")} required value={birth} onChange={(e) => setBirth(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          <p className="text-xs text-muted">{t("consent.birth.why")}</p>
        </div>
        {status === "too_young" && <Toast>{t("consent.toyoung")}</Toast>}
        {needsGuardian && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} className="h-5 w-5 shrink-0" />
            <span>{t("consent.guardian")}</span>
          </label>
        )}
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-5 w-5 shrink-0" />
          <span>{t("consent.terms")} (<Link href="/termos" className="underline" target="_blank">ler</Link>)</span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="h-5 w-5 shrink-0" />
          <span>{t("consent.privacy")} (<Link href="/privacidade" className="underline" target="_blank">ler</Link>)</span>
        </label>
        {error && <Toast>{error}</Toast>}
        <Button type="submit" disabled={!canSubmit}>{t("consent.continue")}</Button>
      </form>
    </main>
  );
}
