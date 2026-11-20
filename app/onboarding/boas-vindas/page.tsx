"use client";

// Welcome card (RF-M03-03): name, goal, level, format, suggested track and the button for the first lesson.
// The entrance animation lasts up to 1.5 s and is off when the system asks to reduce motion.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMe, type MeResponse } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function WelcomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  useEffect(() => {
    void getMe().then(setMe);
  }, []);
  if (!me?.profile) return <p role="status" className="grid min-h-dvh place-items-center text-muted">{t("common.loading")}</p>;
  const p = me.profile;
  const goals = (p.goals ?? []).map((g) => t(`goal.${g}` as "goal.understand")).join(", ") || "—";
  const formats = (p.preferred_formats ?? []).map((f) => t(`format.${f}` as "format.audio")).join(", ") || "—";
  const track = p.goals?.includes("academic") ? t("track.academic") : p.goals?.some((g) => g === "teach" || g === "preach") ? t("track.teach") : p.level === "iniciante" ? t("track.starting") : t("track.default");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <div className="welcome-card flex flex-col gap-4">
        <div className="flex justify-center"><Avatar state="happy" size={96} /></div>
        <h1 className="text-center text-3xl">{t("welcome.title").replace("{name}", p.preferred_name ?? p.display_name ?? "")}</h1>
        <Card className="flex flex-col gap-2">
          <p><span className="text-muted">{t("welcome.goal")}:</span> {goals}</p>
          <p><span className="text-muted">{t("welcome.level")}:</span> <strong>{p.level}</strong> <span className="text-sm text-muted">{t("welcome.level.note")}</span></p>
          <p><span className="text-muted">{t("welcome.format")}:</span> {formats}</p>
          <p><span className="text-muted">{t("welcome.track")}:</span> {track}</p>
        </Card>
        <Button type="button" onClick={() => router.replace("/estudo?primeira=1")}>{t("welcome.start")}</Button>
      </div>
    </main>
  );
}
