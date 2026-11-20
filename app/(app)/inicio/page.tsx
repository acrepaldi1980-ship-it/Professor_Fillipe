"use client";

// Daily home (RF-M09-05): greeting, start button, the student's first topic, the daily goal, a level offer (RF-M03-05)
// and the blocks that will fill in with later modules (continue, review), which invite the student while empty.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLevel, getMe, setLevel, type MeResponse } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const ORDER = ["iniciante", "intermediário", "avançado"];

export default function HomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    void getMe().then(setMe);
    void getLevel().then((l) => {
      setCurrent(l.level);
      setOffer(l.suggestion);
    }).catch(() => undefined);
  }, []);
  const p = me?.profile;
  const name = p?.preferred_name ?? p?.display_name ?? "";
  const up = offer ? ORDER.indexOf(offer) > ORDER.indexOf(current) : true;

  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center gap-3 pt-2">
        <Avatar state="happy" size={72} />
        <h1 className="text-2xl">{t("home.hello")}{name ? `, ${name}` : ""}!</h1>
      </header>
      <Link href="/estudo" className="inline-flex min-h-14 items-center justify-center rounded-control bg-primary px-6 text-lg font-semibold text-primary-ink">
        {t("home.start")}
      </Link>
      {offer && (
        <Card className="flex flex-col gap-2" role="status">
          <p>{t("home.level.offer").replace("{dir}", up ? "mais fundo" : "com mais dificuldade").replace("{act}", up ? "suba" : "desça")}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void setLevel(offer).then(() => { setCurrent(offer); setOffer(null); })}>{t("home.level.yes")}</Button>
            <Button type="button" variant="ghost" onClick={() => setOffer(null)}>{t("home.level.no")}</Button>
          </div>
        </Card>
      )}
      {p?.first_topic && (
        <Card>
          <h2 className="text-lg">{t("home.firsttopic")}</h2>
          <p className="text-muted">{p.first_topic}</p>
          <Link className="mt-1 inline-block underline" href={`/estudo?primeira=1`}>{t("home.start")}</Link>
        </Card>
      )}
      {p?.daily_minutes && (
        <Card>
          <h2 className="text-lg">{t("home.daily")}</h2>
          <p className="text-muted">{t("home.daily.value").replace("{n}", String(p.daily_minutes))}</p>
        </Card>
      )}
      <Card>
        <h2 className="text-lg">{t("home.continue")}</h2>
        <p className="text-muted">{t("home.continue.empty")}</p>
      </Card>
      <Card>
        <h2 className="text-lg">{t("home.review")}</h2>
        <p className="text-muted">{t("home.review.empty")}</p>
      </Card>
    </main>
  );
}
