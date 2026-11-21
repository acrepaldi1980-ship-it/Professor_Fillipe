"use client";

// Public landing: slogan, the professor and the entry points. Signed-in visitors go straight to the app.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/avatar/cena-atos-8.webp" alt={t("landing.scene.alt")} className="w-full shadow-[var(--shadow)]" style={{ borderRadius: "var(--radius)" }} width={1400} height={781} />
      <p className="-mt-3 text-sm text-muted">{t("landing.scene.caption")}</p>
      <h1 className="text-4xl">{t("app.name")}</h1>
      <p className="font-display text-xl italic text-primary">&ldquo;{t("app.tagline")}&rdquo;</p>
      <p className="text-muted">{t("landing.sub")}</p>
      <Link href="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-6 text-lg font-semibold text-primary-ink">
        {t("landing.cta")}
      </Link>
      <Link href="/login" className="text-sm underline">{t("landing.login")}</Link>

      <section aria-labelledby="how" className="flex w-full flex-col gap-2 text-left">
        <h2 id="how" className="text-2xl">{t("landing.how.title")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("landing.how.1")}</li>
          <li>{t("landing.how.2")}</li>
          <li>{t("landing.how.3")}</li>
        </ul>
      </section>

      {/* Space for the demo video the owner will record: replace this block by <video src="/demo.mp4" controls poster="/avatar/cena-atos-8.webp" /> */}
      <div data-testid="demo-slot" className="grid aspect-video w-full place-items-center rounded-control border border-dashed border-line text-sm text-muted">{t("landing.demo")}</div>

      <section aria-labelledby="plans" className="flex w-full flex-col gap-2 text-left">
        <h2 id="plans" className="text-2xl">{t("landing.plans.title")}</h2>
        <ul className="space-y-1">
          <li>{t("landing.plans.free")}</li>
          <li>{t("landing.plans.plus")}</li>
          <li>{t("landing.plans.premium")}</li>
        </ul>
        <Link href="/login" className="underline">{t("landing.plans.see")}</Link>
      </section>

      <Link href="/instalar" className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-line px-6 font-semibold">{t("landing.install")}</Link>
      <p className="text-xs text-muted">{t("landing.ia")}</p>
      <p className="flex gap-4 text-sm text-muted">
        <Link href="/termos" className="underline">Termos</Link>
        <Link href="/privacidade" className="underline">Privacidade</Link>
        <Link href="/fontes-e-licencas" className="underline">Fontes e licenças</Link>
      </p>
    </main>
  );
}
