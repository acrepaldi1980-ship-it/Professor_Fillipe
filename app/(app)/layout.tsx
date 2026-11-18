"use client";

// Signed-in area: login and onboarding guard + bottom navigation. All data comes through lib/api-client.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/ui/BottomNav";
import { getMe } from "@/lib/api-client";
import { currentSession } from "@/lib/auth/client";
import { t } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await currentSession();
        if (!session) return router.replace("/login");
        const me = await getMe();
        if (cancelled) return;
        if (me.onboarding.needsConsent) return router.replace("/onboarding/consentimento");
        if (me.onboarding.needsReligiousChoice) return router.replace("/onboarding/dado-religioso");
        setReady(true);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <p role="status" className="grid min-h-dvh place-items-center text-muted">{t("common.loading")}</p>;
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav />
    </div>
  );
}
