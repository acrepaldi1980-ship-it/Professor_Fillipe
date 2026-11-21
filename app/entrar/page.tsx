"use client";

// Public landing of an invite link or QR code (/entrar?c=CODE): keeps the code, then sends to the login (new people) or to the church screen.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/auth/client";
import { getPlatform } from "@/lib/platform";
import { t } from "@/lib/i18n";

export default function JoinLanding() {
  const router = useRouter();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("c")?.trim();
    void (async () => {
      if (code && /^[A-Za-z0-9]{6,20}$/.test(code)) await getPlatform().store.set("pf-join-code", code.toUpperCase());
      const s = await currentSession().catch(() => null);
      router.replace(s ? "/igreja" : "/login");
    })();
  }, [router]);
  return <main className="grid min-h-dvh place-items-center p-6"><p role="status" className="text-muted">{t("church.join.opening")}</p></main>;
}
