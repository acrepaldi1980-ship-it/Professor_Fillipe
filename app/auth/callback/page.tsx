"use client";

// Return point of magic links and Google login: the auth client (PKCE) exchanges the code for a session.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/teacher/Avatar";
import { Toast } from "@/components/ui/Toast";
import { currentSession, watchSession } from "@/lib/auth/client";
import { t } from "@/lib/i18n";

export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        router.replace("/inicio");
      }
    };
    const off = watchSession((s) => s && go());
    void currentSession().then((s) => s && go());
    const timer = setTimeout(() => !done && setFailed(true), 10_000);
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Avatar state={failed ? "empathetic" : "thinking"} size={96} />
      {failed ? (
        <>
          <Toast>{t("callback.error")}</Toast>
          <a href="/login" className="underline">{t("common.back")}</a>
        </>
      ) : (
        <p role="status">{t("callback.wait")}</p>
      )}
    </main>
  );
}
