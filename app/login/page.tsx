"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth/client";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      await signInWithEmail(email.trim());
      setState("sent");
    } catch (err) {
      setState("idle");
      setError((err as Error).message === "rate_limited" ? t("login.error.rate") : t("login.error.email"));
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError(t("login.error.google"));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <div className="flex flex-col items-center gap-2">
        <Avatar state={state === "sent" ? "happy" : "idle"} size={96} />
        <h1 className="text-3xl">{t("login.title")}</h1>
      </div>

      {state === "sent" ? (
        <div className="flex flex-col gap-3 text-center">
          <Toast tone="ok">{t("login.sent")}</Toast>
          <p className="text-sm text-muted">{t("login.sent.hint")}</p>
        </div>
      ) : (
        <>
          <form onSubmit={sendLink} className="flex flex-col gap-3">
            <Field id="email" type="email" inputMode="email" autoComplete="email" required label={t("login.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={state === "sending" || !email}>{t("login.send")}</Button>
          </form>
          <p className="text-center text-sm text-muted">{t("login.or")}</p>
          <Button type="button" variant="ghost" onClick={() => void google()}>{t("login.google")}</Button>
        </>
      )}

      {error && <Toast>{error}</Toast>}
      <p className="text-center text-xs text-muted">
        {t("login.terms")} <Link href="/termos" className="underline">Termos</Link> · <Link href="/privacidade" className="underline">Privacidade</Link>
      </p>
    </main>
  );
}
