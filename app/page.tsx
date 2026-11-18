"use client";

// Public landing: slogan, the professor and the entry points. Signed-in visitors go straight to the app.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/teacher/Avatar";
import { currentSession } from "@/lib/auth/client";
import { t } from "@/lib/i18n";

export default function Landing() {
  const router = useRouter();
  useEffect(() => {
    void currentSession()
      .then((s) => s && router.replace("/inicio"))
      .catch(() => {});
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
      <Avatar state="idle" size={160} />
      <h1 className="text-4xl">{t("app.name")}</h1>
      <p className="font-display text-xl italic text-primary">&ldquo;{t("app.tagline")}&rdquo;</p>
      <p className="text-muted">{t("landing.sub")}</p>
      <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-6 text-lg font-semibold text-primary-ink">
        {t("landing.cta")}
      </Link>
      <p className="flex gap-4 text-sm text-muted">
        <Link href="/termos" className="underline">Termos</Link>
        <Link href="/privacidade" className="underline">Privacidade</Link>
      </p>
    </main>
  );
}
