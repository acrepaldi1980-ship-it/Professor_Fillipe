"use client";

// Daily home (RF-M09-05): greeting, start button, the student's first topic, the daily goal, a level offer (RF-M03-05)
// and the blocks that will fill in with later modules (continue, review), which invite the student while empty.
import { useEffect, useState } from "react";
import Link from "next/link";
import { REFERRAL_KEY } from "@/components/ReferralCapture";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getDueCards, getLevel, getMe, getMyLessons, getRecentSessions, claimReferral, getReferral, getStreak, listPaths, setLevel, type ChurchLesson, type MeResponse, type PathSummary, type SessionRow, type StreakData } from "@/lib/api-client";
import { isLang, t } from "@/lib/i18n";
import { applyLanguage, loadLanguage, saveLanguage } from "@/lib/i18n/lang";
import { getPlatform } from "@/lib/platform";

// Theme of the week: rotates through the year (no spending, just a gentle invitation).
const THEMES = ["O Sermão do Monte", "A oração do Pai Nosso", "Os Salmos de louvor", "A vida de José", "O livro de Rute", "As parábolas do Reino", "A carta de Tiago", "Os milagres de Jesus", "A história de Daniel", "O fruto do Espírito", "A igreja em Atos", "Os profetas e a esperança"];
const weekTheme = () => THEMES[Math.floor(Date.now() / (7 * 86_400_000)) % THEMES.length];

const ORDER = ["iniciante", "intermediário", "avançado"];

import archItems from "@/lib/archaeology/items.json";
const HAS_ARCH = (archItems as { image?: string }[]).filter((x) => x.image).length >= 6;

export default function HomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [due, setDue] = useState(0);
  const [last, setLast] = useState<SessionRow | null>(null);
  const [lessons, setLessons] = useState<ChurchLesson[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [refNotice, setRefNotice] = useState(false);
  useEffect(() => {
    void getMyLessons().then((r) => setLessons(r.lessons)).catch(() => undefined); // the lesson of the week published by the student's church
    void getMe().then(async (m) => {
      setMe(m);
      // a new device: the language saved on the profile applies here too (compared with the stored one, so there is no reload loop)
      const loc = m.profile?.locale;
      if (isLang(loc) && loc !== (await loadLanguage())) { await saveLanguage(loc); applyLanguage(loc); window.location.reload(); }
    });
    void getStreak(true).then(setStreak).catch(() => undefined);
    void listPaths().then((r) => setPaths(r.paths)).catch(() => undefined);
    // arrived through a friend's link: record it once, then settle (both earn days after 2 study days)
    void (async () => {
      try {
        const store = getPlatform().store;
        const code = await store.get<string>(REFERRAL_KEY);
        if (code) { await claimReferral(code).catch(() => undefined); await store.remove(REFERRAL_KEY); }
        const r = await getReferral();
        if (r.settled?.settled) setRefNotice(true);
      } catch { /* the home works without it */ }
    })();
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
      {streak && streak.current >= 2 && (
        <p className="text-sm text-muted" data-testid="streak">{t(streak.studied_today ? "streak.today" : "streak.alive").replace("{n}", String(streak.current))}{streak.new_milestones.length > 0 ? ` ${t("streak.milestone").replace("{n}", streak.new_milestones.find((m) => m.startsWith("streak_"))?.slice(7) ?? "")}` : ""}</p>
      )}
      {refNotice && <p role="status" className="rounded-control border border-primary bg-surface p-3 text-sm">{t("referral.settled")}</p>}
      <Link href="/estudo" className="inline-flex min-h-14 items-center justify-center rounded-control bg-primary px-6 text-lg font-semibold text-primary-ink">
        {t("home.start")}
      </Link>
      {lessons.length > 0 && (
        <section aria-label={t("home.church.title")} className="flex flex-col gap-2">
          <h2 className="text-lg">{t("home.church.title")}</h2>
          {lessons.map((l) => (
            <Link key={l.id} href={`/estudo?lesson=${l.id}&titulo=${encodeURIComponent(l.title)}`} className="rounded-control border border-primary bg-surface p-3">
              <strong>{t("home.church.open").replace("{title}", l.title)}</strong>
              <span className="block text-sm text-muted">{l.class} · {l.church}{l.ref ? ` · ${l.ref}` : ""}</span>
            </Link>
          ))}
        </section>
      )}
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
        {HAS_ARCH && <Link href="/arqueologia" className="rounded-control border border-line bg-surface p-3"><strong>{t("arch.title")}</strong><span className="block text-sm text-muted">{t("home.arch.help")}</span></Link>}
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
        <h2 className="text-lg">{t("paths.home")}</h2>
        {(() => { const cur = paths.find((x) => x.started && !x.completed); const p = cur ?? paths.find((x) => !x.started); return p ? (<><p className="text-muted">{p.title}{p.next_day && p.started ? ` · ${t("paths.day").replace("{n}", String(p.next_day.day))}: ${p.next_day.title}` : ""}</p><Link className="mt-1 inline-block underline" href={p.started && p.next_day ? `/estudo?trilha=${p.id}&dia=${p.next_day.day}` : `/trilhas?id=${p.id}`}>{p.started ? t("paths.continue") : t("paths.begin")}</Link>{" · "}<Link className="underline" href="/trilhas">{t("paths.all")}</Link></>) : <Link className="underline" href="/trilhas">{t("paths.all")}</Link>; })()}
      </Card>
      <Card>
        <h2 className="text-lg">{t("home.imm")}</h2>
        <p className="text-muted">{t("home.imm.desc")}</p>
        <Link className="mt-1 inline-block underline" href="/imersao">{t("home.imm.go")}</Link>
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
