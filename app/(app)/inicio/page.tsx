"use client";

// Daily home (RF-M09-05): greeting, start button, the student's first topic, the daily goal, a level offer (RF-M03-05)
// and the blocks that will fill in with later modules (continue, review), which invite the student while empty.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getDueCards, getLevel, getMe, getRecentSessions, setLevel, type MeResponse, type SessionRow } from "@/lib/api-client";
import { t } from "@/lib/i18n";

// Theme of the week: rotates through the year (no spending, just a gentle invitation).
const THEMES = ["O Sermão do Monte", "A oração do Pai Nosso", "Os Salmos de louvor", "A vida de José", "O livro de Rute", "As parábolas do Reino", "A carta de Tiago", "Os milagres de Jesus", "A história de Daniel", "O fruto do Espírito", "A igreja em Atos", "Os profetas e a esperança"];
const weekTheme = () => THEMES[Math.floor(Date.now() / (7 * 86_400_000)) % THEMES.length];

const ORDER = ["iniciante", "intermediário", "avançado"];

export default function HomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [due, setDue] = useState(0);
  const [last, setLast] = useState<SessionRow | null>(null);
  useEffect(() => {
    void getMe().then(setMe);
    void getDueCards(1).then((r) => setDue(r.total)).catch(() => undefined);
    void getRecentSessions(1).then((r) => setLast(r.sessions[0] ?? null)).catch(() => undefined);
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
      <section aria-label={t("modes.title")} className="grid grid-cols-2 gap-2">
        {(["lesson", "sermon", "deep"] as const).map((m) => (
          <Link key={m} href={`/modos?m=${m}`} className="rounded-control border border-line bg-surface p-3">
            <strong>{t(`modes.${m}`)}</strong>
            <span className="block text-sm text-muted">{t(`modes.${m}.help`)}</span>
          </Link>
        ))}
      </section>
      <section aria-label={t("home.explore")} className="grid grid-cols-2 gap-2">
        <Link href="/curiosidades" className="rounded-control border border-line bg-surface p-3"><strong>{t("cur.title")}</strong><span className="block text-sm text-muted">{t("home.cur.help")}</span></Link>
        <Link href="/arqueologia" className="rounded-control border border-line bg-surface p-3"><strong>{t("arch.title")}</strong><span className="block text-sm text-muted">{t("home.arch.help")}</span></Link>
      </section>
      <Link href="/visuais" className="rounded-control border border-line bg-surface p-3"><strong>{t("home.visuals")}</strong><span className="block text-sm text-muted">{t("home.visuals.help")}</span></Link>
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
        <h2 className="text-lg">{t("home.cont")}</h2>
        {last ? (
          <>
            <p className="text-muted">{last.topic || t(`modes.${(["lesson", "sermon", "deep"].includes(last.mode) ? last.mode : "free") as "free"}`)} · {new Date(last.started_at).toLocaleDateString("pt-BR")}</p>
            <Link className="mt-1 inline-block underline" href={last.ended_at ? `/fechamento?s=${last.id}` : `/estudo?s=${last.id}`}>{t("home.cont.go")}</Link>
          </>
        ) : <p className="text-muted">{t("home.cont.empty")}</p>}
      </Card>
      <Card>
        <h2 className="text-lg">{t("home.review.due").replace("{n}", String(due))}</h2>
        {due > 0 ? <Link className="mt-1 inline-block underline" href="/revisao">{t("home.review.go")}</Link> : <p className="text-muted">{t("home.review.empty")}</p>}
      </Card>
      <Card>
        <h2 className="text-lg">{t("home.track")}</h2>
        <p className="text-muted">{p?.goals?.includes("academic") ? t("track.academic") : p?.goals?.some((g) => g === "teach" || g === "preach") ? t("track.teach") : p?.level === "iniciante" ? t("track.starting") : t("track.default")}</p>
      </Card>
      <Card>
        <h2 className="text-lg">{t("home.week")}</h2>
        <p className="text-muted">{weekTheme()}</p>
        <Link className="mt-1 inline-block underline" href={`/estudo?tema=${encodeURIComponent(weekTheme())}`}>{t("home.week.go")}</Link>
      </Card>
    </main>
  );
}
