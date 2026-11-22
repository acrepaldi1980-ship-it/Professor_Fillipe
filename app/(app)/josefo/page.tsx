"use client";

// Flávio Josefo (módulo M20): the four works and 30 books in Whiston's public-domain translation, book summaries, famous passages and a reader by chapter,
// with the teacher as guide (he presents Josephus as a source and never speaks as him: RA-21). The open place travels in the query string (?w=&b=&c=).
import Link from "next/link";
import { useEffect, useState } from "react";
import { SceneArt } from "@/components/characters/SceneArt";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useNarrator } from "@/components/useNarrator";
import { getBibleVerses, getJosephus, getJosephusChapter, type JosephusBook, type JosephusChapter, type JosephusToc, type JosephusWork } from "@/lib/api-client";
import { sc } from "@/lib/characters/data/helpers";
import { parseCite } from "@/lib/josephus/books";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const SCENE = sc("city", "dusk", [["temple", 66, 0.3, 1.3], ["scroll", 30, 0.85, 1.2], ["wall", 90, 0.25], ["palm", 14, 0.4]], [["man", 46, 0.8, "stand", "scroll", "#8a6a45"]]);
const href = (w: string, b?: number, c?: number) => `/josefo?w=${w}${b !== undefined ? `&b=${b}` : ""}${c !== undefined ? `&c=${c}` : ""}`;
const chapterLabel = (w: string, b: number, c: number) => (w === "life" ? "Vida" : w === "apion" ? `Ap. ${b}` : `${w === "ant" ? "Ant." : "Guerra"} ${b}.${c}`);

export default function JosephusPage() {
  const [toc, setToc] = useState<JosephusToc | null>(null);
  const [place, setPlace] = useState<{ w: JosephusWork | null; b: number | null; c: number | null }>({ w: null, b: null, c: null });
  const [chap, setChap] = useState<JosephusChapter | null>(null);
  const [error, setError] = useState(false);
  const [original, setOriginal] = useState(false);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const { playing, play, stop } = useNarrator();

  useEffect(() => {
    const sync = () => { const q = new URLSearchParams(window.location.search); const n = (k: string) => (q.get(k) === null ? null : Number(q.get(k))); setPlace({ w: (q.get("w") as JosephusWork | null), b: n("b"), c: n("c") }); };
    sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => { void getJosephus().then(setToc).catch(() => setError(true)); }, []);
  useEffect(() => {
    setChap(null);
    if (place.w && place.b !== null && place.c !== null) { setError(false); void getJosephusChapter(place.w, place.b, place.c).then((r) => { setChap(r); window.scrollTo({ top: 0 }); }).catch(() => setError(true)); }
  }, [place]);
  async function openVerse(ref: string) {
    try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses.length ? r.verses : [{ ref, text: t("study.verse.error") }] }); } catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); }
  }
  const go = (w: string | null, b?: number, c?: number) => (e: React.MouseEvent) => { e.preventDefault(); const u = w ? href(w, b, c) : "/josefo"; window.history.pushState(null, "", u); window.dispatchEvent(new PopStateEvent("popstate")); };
  const modal = verse && <Modal title={verse.title} onClose={() => setVerse(null)}>{verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}<Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button></Modal>;

  // ---- reader
  if (place.w && place.b !== null && place.c !== null) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
        <Link href={href(place.w, place.b === 0 ? undefined : place.b)} onClick={go(place.w, place.b === 0 ? undefined : place.b)} className="self-start text-sm underline">{t("jos.back")}</Link>
        {error && <p role="alert">{t("jos.error")}</p>}
        {!chap && !error && <p className="text-muted">{t("common.loading")}</p>}
        {chap && (
          <article className="flex flex-col gap-3">
            <header><p className="text-sm text-muted">{toc?.works.find((x) => x.key === chap.work)?.title}</p><h1 className="font-serif text-2xl font-bold">{chap.book === 0 ? t("jos.preface") : chapterLabel(chap.work, chap.book, chap.chapter)}{chap.title ? `: ${chap.title}` : ""}</h1></header>
            <p className="text-xs text-muted">{chap.sections.every((s) => s.text_pt) ? t("jos.lang.pt") : chap.sections.some((s) => s.text_pt) ? t("jos.lang.partial") : t("jos.lang.wait")}</p>
            {chap.sections.some((s) => s.text_pt) && <button type="button" className="self-start text-sm underline" onClick={() => setOriginal((o) => !o)}>{original ? t("jos.show.pt") : t("jos.show.en")}</button>}
            <div className="flex flex-wrap gap-2">
              <Link href={`/estudo?jos=${chap.work}.${chap.book}.${chap.chapter}`} className="rounded-control bg-primary px-3 py-2 text-white">{t("jos.ask")}</Link>
              {chap.parallels.flatMap((p) => p.refs.slice(0, 3).map((r) => <button key={`${p.n}${r}`} type="button" className="rounded-full border border-line bg-surface px-3 py-1" title={p.cite} onClick={() => void openVerse(r)}>{p.cite} ↔ {formatRefPt(r)}</button>))}
            </div>
            {chap.controversies.map((k) => <aside key={k.cite} role="note" className="rounded-control border border-line bg-surface p-3 text-[15px]"><strong>{k.title}</strong> <span className="text-muted">({k.cite})</span><p className="mt-1">{k.text}</p></aside>)}
            <div className="flex flex-col gap-3 text-[17px] leading-relaxed">{chap.sections.map((s) => <p key={s.n} id={`s${s.n}`} lang={original || !s.text_pt ? "en" : "pt-BR"}><sup className="mr-1 font-semibold text-muted">{s.n}</sup>{original ? s.text : (s.text_pt ?? s.text)}</p>)}</div>
            <nav className="flex justify-between gap-2" aria-label="capítulos">
              {chap.prev ? <Link className="rounded-control border border-line bg-surface px-3 py-2" href={href(chap.prev.work, chap.prev.book, chap.prev.chapter)} onClick={go(chap.prev.work, chap.prev.book, chap.prev.chapter)}>← {t("jos.prev")}</Link> : <span />}
              {chap.next ? <Link className="rounded-control border border-line bg-surface px-3 py-2" href={href(chap.next.work, chap.next.book, chap.next.chapter)} onClick={go(chap.next.work, chap.next.book, chap.next.chapter)}>{t("jos.next")} →</Link> : <span />}
            </nav>
            <p className="text-xs text-muted">{t("jos.credit")}</p>
          </article>
        )}
        {modal}
      </main>
    );
  }

  // ---- one book
  const work = toc?.works.find((x) => x.key === place.w);
  const book: JosephusBook | undefined = work?.books.find((b) => b.book === place.b);
  if (place.w && book && work) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
        <Link href="/josefo" onClick={go(null)} className="self-start text-sm underline">{t("jos.back")}</Link>
        <header><p className="text-sm text-muted">{work.title}</p><h1 className="font-serif text-2xl font-bold">{book.title}</h1><p className="text-muted">{book.span}</p></header>
        <p className="text-[17px] leading-relaxed">{book.summary}</p>
        {book.key.length > 0 && <section><h2 className="font-serif text-xl font-bold">{t("jos.key")}</h2><ul className="mt-2 flex flex-col gap-2">{book.key.map((k) => { const c = parseCite(k.cite); return <li key={k.cite} className="rounded-control border border-line bg-surface p-3"><strong>{k.cite}</strong>: {k.why}{c && <> · <Link className="underline" href={href(c.work, c.book, c.chapter)} onClick={go(c.work, c.book, c.chapter)}>{t("jos.read")}</Link></>}{k.ref && <> · <button type="button" className="underline" onClick={() => void openVerse(k.ref!)}>{formatRefPt(k.ref)}</button></>}</li>; })}</ul></section>}
        <section><h2 className="font-serif text-xl font-bold">{t("jos.chapters")}</h2><ol className="mt-2 flex flex-col gap-1">{book.chapters.map((c) => <li key={c.chapter}><Link className="flex items-baseline justify-between gap-2 rounded-control border border-line bg-surface p-2" href={href(work.key, book.book, c.chapter)} onClick={go(work.key, book.book, c.chapter)}><span><strong>{work.key === "life" || work.key === "apion" ? t("jos.read") : c.chapter}</strong> {c.title && `· ${c.title}`}</span><span className="text-xs text-muted">{t("jos.sections").replace("{n}", String(c.sections))}</span></Link></li>)}</ol></section>
        {modal}
      </main>
    );
  }

  // ---- home
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <header className="relative overflow-hidden rounded-2xl border border-line">
        <SceneArt spec={SCENE} seed={37} className="block h-52 w-full" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white"><h1 className="font-serif text-3xl font-bold">{t("jos.title")}</h1><p className="opacity-90">{toc?.bio.hebrew} · {toc?.bio.years}</p></div>
      </header>
      <p className="text-muted">{t("jos.subtitle")}</p>
      {error && <p role="alert">{t("jos.error")}</p>}
      {toc && (
        <section className="flex flex-col gap-2 rounded-control border border-line bg-surface p-4">
          <h2 className="font-serif text-xl font-bold">{t("jos.intro.title")}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">{toc.bio.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="text-sm text-muted">{toc.bio.note}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => (playing === "bio" ? stop() : void play("bio", `${t("jos.title")}. ${toc.bio.lines.join(" ")} ${toc.bio.note}`))}>{playing === "bio" ? `⏹ ${t("jos.stop")}` : `🔊 ${t("jos.listen")}`}</Button>
            <Link href="/estudo?jos=life.1.1" className="rounded-control bg-primary px-3 py-2 text-white">{t("jos.talk")}</Link>
          </div>
        </section>
      )}
      <h2 className="font-serif text-xl font-bold">{t("jos.works")}</h2>
      {!toc && !error && <p className="text-muted">{t("common.loading")}</p>}
      {toc?.works.map((w) => (
        <section key={w.key} className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
          <h3 className="font-serif text-lg font-bold">{w.title}</h3>
          <div className="flex flex-wrap gap-2">{w.books.map((b) => <Link key={b.book} href={w.key === "life" ? href(w.key, 1, 1) : b.book === 0 ? href(w.key, 0, 0) : href(w.key, b.book)} onClick={go(w.key, ...(w.key === "life" ? [1, 1] : b.book === 0 ? [0, 0] : [b.book]) as [number, number?])} className="rounded-full border border-line px-3 py-1" title={b.title}>{b.book === 0 ? t("jos.preface") : w.key === "life" ? w.title : w.books.length === 1 ? w.title : b.book}</Link>)}</div>
        </section>
      ))}
      <p className="text-xs text-muted">{t("jos.source")}</p>
    </main>
  );
}
