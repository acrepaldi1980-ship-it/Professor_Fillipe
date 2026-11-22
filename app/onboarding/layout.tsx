"use client";

// Onboarding guard: the screens call the API right away, so wait for the saved session first (a hard reload used to fire the call before the
// session was read and leave the screen stuck on "loading" with an unhandled 401). Visitors are sent to the login screen.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentSession } from "@/lib/auth/client";
import { t } from "@/lib/i18n";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    currentSession().then((s) => { if (cancelled) return; if (!s) router.replace("/login"); else setReady(true); }).catch(() => { if (!cancelled) router.replace("/login"); });
    return () => { cancelled = true; };
  }, [router]);
  if (!ready) return <p role="status" className="grid min-h-dvh place-items-center text-muted">{t("common.loading")}</p>;
  return <>{children}</>;
}
