"use client";

// Guided install (PWA): Android/desktop use the browser prompt; iPhone/iPad get a step by step (Safari has no prompt).
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { t } from "@/lib/i18n";

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

export function InstallGuide() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onDone = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onDone);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onDone); };
  }, []);

  if (installed) return <Card><p role="status">{t("install.done")}</p></Card>;
  return (
    <div className="flex flex-col gap-3">
      {evt && (
        <Card className="flex flex-col gap-2">
          <p>{t("install.android")}</p>
          <div><Button type="button" onClick={() => void evt.prompt().then(() => evt.userChoice).then(() => setEvt(null))}>{t("install.button")}</Button></div>
        </Card>
      )}
      <Card className="flex flex-col gap-2" data-testid="ios-steps">
        <h2 className="text-lg">{t("install.ios.title")}</h2>
        {ios && <p className="text-sm text-primary">{t("install.ios.you")}</p>}
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("install.ios.1")}</li>
          <li>{t("install.ios.2")}</li>
          <li>{t("install.ios.3")}</li>
          <li>{t("install.ios.4")}</li>
        </ol>
      </Card>
      {!evt && !ios && <Card><p className="text-sm text-muted">{t("install.other")}</p></Card>}
    </div>
  );
}
