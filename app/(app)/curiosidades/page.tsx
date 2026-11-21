"use client";

// Biblical curiosities (spec 8.18, RF-M18-02): short films and pre-recorded narrations about discoveries and facts tied to the Bible.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { getBibleVerses, trackEvent } from "@/lib/api-client";
import catalog from "@/lib/curiosities/catalog.json";
import { audioUrl, posterUrl, videoUrl } from "@/lib/curiosities/media";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

type Cur = { id: string; title: string; refs: string[]; sources: string[]; duration: number; sentences: { text: string; start: number; end: number }[]; images: { id: string; image: string; name: string; credit?: { title: string; author: string; license: string; page: string } }[]; hasVideo: boolean };
const ALL = catalog as Cur[];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function CuriositiesPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { setOpenId(new URLSearchParams(window.location.search).get("c")); }, []);
  const cur = useMemo(() => ALL.find((c) => c.id === openId) ?? null, [openId]);
  return cur ? <Detail cur={cur} onBack={() => { setOpenId(null); history.replaceState(null, "", "/curiosidades"); }} /> : (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("cur.title")}</h1>
      <p className="text-muted">{t("cur.help")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ALL.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => { setOpenId(c.id); history.replaceState(null, "", `/curiosidades?c=${c.id}`); trackEvent("visual_opened", { kind: "curiosity" }); }} className="flex h-full w-full flex-col overflow-hidden rounded-control border border-line bg-surface text-left">
              {c.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.images[0].image} alt="" loading="lazy" className="aspect-video w-full object-cover" />
              )}
              <span className="flex flex-col gap-0.5 p-3"><strong>{c.title}</strong><span className="text-sm text-muted">{c.hasVideo ? t("cur.film") : t("cur.audio")} · {fmt(c.duration)}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Detail({ cur, onBack }: { cur: Cur; onBack: () => void }) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [mode, setMode] = useState<"film" | "audio">(cur.hasVideo ? "film" : "audio");
  const [now, setNow] = useState(0);
  const [failed, setFailed] = useState(false);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const active = cur.sentences.findIndex((s) => now >= s.start && now < s.end + 0.4);
  const slide = cur.images.length ? cur.images[Math.min(cur.images.length - 1, Math.floor((now / Math.max(cur.duration, 1)) * cur.images.length))] : null;

  async function openRef(ref: string) {
    for (let a = 0; a < 2; a++) {
      try {
        const r = await getBibleVerses(defaultBibleVersion(), ref);
        if (r.verses.length) return setVerse({ title: formatRefPt(ref), lines: r.verses });
      } catch { /* retry once */ }
    }
    setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] });
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={onBack} className="self-start underline">{t("cur.back")}</button>
      <h1 className="text-2xl">{cur.title}</h1>
      <div role="radiogroup" aria-label={t("cur.mode")} className="flex gap-2">
        {cur.hasVideo && <button type="button" role="radio" aria-checked={mode === "film"} onClick={() => setMode("film")} className={`min-h-11 flex-1 rounded-control border ${mode === "film" ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{t("cur.film")}</button>}
        <button type="button" role="radio" aria-checked={mode === "audio"} onClick={() => setMode("audio")} className={`min-h-11 flex-1 rounded-control border ${mode === "audio" ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{t("cur.audio")}</button>
      </div>
      {mode === "film" ? (
        <video key={cur.id} ref={mediaRef} src={videoUrl(cur.id)} poster={posterUrl(cur.id)} controls playsInline preload="metadata" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} onError={() => setFailed(true)} className="aspect-video w-full rounded-control bg-black" />
      ) : (
        <div className="flex flex-col gap-2">
          {slide && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.image} alt={slide.name} className="aspect-video w-full rounded-control object-cover" />
          )}
          <audio key={cur.id} ref={mediaRef} src={audioUrl(cur.id)} controls preload="metadata" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} onError={() => setFailed(true)} className="w-full" />
        </div>
      )}
      {failed && <p role="alert" className="text-sm text-muted">{t("cur.error")}</p>}
      <Card className="flex flex-col gap-2" aria-label={t("cur.text")}>
        <h2 className="text-lg">{t("cur.text")}</h2>
        <p className="leading-relaxed">{cur.sentences.map((s, i) => <span key={i} className={i === active ? "rounded bg-primary/15 px-0.5" : ""}>{s.text} </span>)}</p>
      </Card>
      <div className="flex flex-wrap gap-2">{cur.refs.map((r) => <Button key={r} type="button" variant="ghost" onClick={() => void openRef(r)}>{formatRefPt(r)}</Button>)}</div>
      <Card className="text-xs text-muted">
        <p>{t("arch.source")}: {cur.sources.join("; ")}</p>
        {cur.images.map((im) => im.credit && <p key={im.id}>{t("arch.photo")}: <a className="underline" href={im.credit.page} target="_blank" rel="noreferrer">{im.credit.title}</a>, {im.credit.author || "autor não informado"}, {im.credit.license}</p>)}
        <p className="mt-1">{t("cur.narration")}</p>
      </Card>
      <Link href={`/estudo?tema=${encodeURIComponent(cur.title)}`} className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-4 font-semibold text-primary-ink">{t("cur.study")}</Link>
      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}
