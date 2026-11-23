"use client";

// Historiadores (módulo M21): the ancient historians of the Bible's world in one place, with the testimonies side by side, and everything connected to the teacher
// (each author, work and passage opens a study with him). Static content: the screen loads instantly and works offline. The open author travels in ?a=.
import Link from "next/link";
import { useEffect, useState } from "react";
import { SceneArt } from "@/components/characters/SceneArt";
import { soft } from "@/components/characters/nav";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getBibleVerses, listHistBooks, type HistBook } from "@/lib/api-client";
import { sc } from "@/lib/characters/data/helpers";
import { byId, HISTORIANS, TESTIMONIES, type Status } from "@/lib/historians/data";
import { defaultBibleVersion, t, type MessageKey } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const SCENE = sc("city", "dusk", [["scroll", 28, 0.85, 1.3], ["temple", 66, 0.3, 1.2], ["tower", 88, 0.25], ["house", 12, 0.4]], [["man", 46, 0.8, "sit", "scroll", "#8a6a45"]]);
const STATUS: Record<Status, MessageKey> = { reader: "hist.status.reader", library: "hist.status.library", planned: "hist.status.planned" };

export default function HistoriansPage() {
  const [a, setA] = useState<string | null>(null);
  const [books, setBooks] = useState<HistBook[]>([]);
  useEffect(() => { void listHistBooks().then((r) => setBooks(r.works)).catch(() => undefined); }, []);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  useEffect(() => { const sync = () => setA(new URLSearchParams(window.location.search).get("a")); sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [a]);
  async function openVerse(ref: string) { try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses.length ? r.verses : [{ ref, text: t("study.verse.error") }] }); } catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); } }
  const modal = verse && <Modal title={verse.title} onClose={() => setVerse(null)}>{verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}<Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button></Modal>;
  const h = a ? byId(a) : undefined;

  if (h) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
        <Link href="/historiadores" onClick={soft("/historiadores")} className="self-start text-sm underline">{t("hist.back")}</Link>
        <header><h1 className="font-serif text-3xl font-bold">{h.name}</h1><p className="text-muted">{h.years} · {h.role}</p></header>
        <p className="text-[17px] leading-relaxed">{h.summary}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">{h.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <div className="flex flex-wrap gap-2">
          <Link href={`/estudo?hist=${h.id}`} className="rounded-control bg-primary px-3 py-2 text-white">{t("hist.talk")}</Link>
          {h.id === "josefo" && <Link href="/josefo" className="rounded-control border border-line bg-surface px-3 py-2">{t("hist.read")}</Link>}
        </div>
        <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("hist.works")}</h2>
          {h.works.map((w) => { const bk = books.find((b) => b.author === h.id && (b.id === w.id || b.title.toLowerCase().startsWith(w.title.toLowerCase().slice(0, 8)))); return <div key={w.id} className="rounded-control border border-line bg-surface p-3"><strong>{w.title}</strong> <span className="text-sm text-muted">({w.original})</span><p className="text-sm">{w.what}</p><p className="mt-1 text-xs text-muted">{bk ? t("hist.status.reader.n").replace("{n}", String(bk.units)) : t(STATUS[w.status])} · {bk?.edition ?? w.edition}</p>{bk && <Link href={`/historiadores/ler?w=${bk.id}`} className="mt-1 inline-block rounded-control bg-primary px-3 py-1 text-sm text-white">{t("hist.read.work")}</Link>}</div>; })}
        </section>
        <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("hist.passages")}</h2>
          {h.passages.map((p) => (
            <article key={p.id} className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3">
              <strong>{p.cite}: {p.topic}</strong><p className="text-[15px]">{p.summary}</p>
              {p.debate && <p className="rounded bg-black/5 p-2 text-sm"><strong>{t("hist.debate")}: </strong>{p.debate}</p>}
              <div className="flex flex-wrap gap-2 pt-1"><Link className="underline" href={`/estudo?hist=${h.id}.${p.id}`}>{t("hist.ask")}</Link>{p.refs.slice(0, 3).map((r) => <button key={r} type="button" className="underline" onClick={() => void openVerse(r)}>{formatRefPt(r)}</button>)}</div>
            </article>
          ))}
        </section>
        <p className="rounded-control border border-line bg-surface p-3 text-sm"><strong>{t("hist.limits")}: </strong>{h.limits}</p>
        {modal}
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <header className="relative overflow-hidden rounded-2xl border border-line"><SceneArt spec={SCENE} seed={91} className="block h-44 w-full" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white"><h1 className="font-serif text-3xl font-bold">{t("hist.title")}</h1></div></header>
      <p className="text-muted">{t("hist.subtitle")}</p>
      <div className="flex flex-wrap gap-2"><Link href="/estudo?hist=testemunhos" className="rounded-control bg-primary px-3 py-2 text-white">{t("hist.compare")}</Link></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HISTORIANS.map((x) => (
          <Link key={x.id} href={`/historiadores?a=${x.id}`} onClick={soft(`/historiadores?a=${x.id}`)} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3">
            <strong className="font-serif text-lg">{x.name}</strong><span className="text-xs text-muted">{x.years}</span><span className="text-sm">{x.summary}</span>
            <span className="mt-1 text-xs text-muted">{t("hist.works.count").replace("{n}", String(x.works.length))}{x.works.some((w) => w.status === "reader") ? ` · ${t("hist.status.reader")}` : ""}</span>
          </Link>
        ))}
      </div>
      <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("hist.testimonies")}</h2><p className="text-sm text-muted">{t("hist.testimonies.help")}</p>
        <div className="overflow-x-auto"><table className="min-w-[640px] border-collapse text-sm"><thead><tr className="text-left">{["hist.col.who", "hist.col.says", "hist.col.indep", "hist.col.debate"].map((k) => <th key={k} className="border-b border-line p-2">{t(k as MessageKey)}</th>)}</tr></thead>
          <tbody>{TESTIMONIES.map((x) => <tr key={x.who} className="align-top"><td className="border-b border-line p-2"><strong>{x.who}</strong><br /><span className="text-muted">{x.cite} · {x.date}</span></td><td className="border-b border-line p-2">{x.says}</td><td className="border-b border-line p-2">{x.independent}</td><td className="border-b border-line p-2">{x.debate}</td></tr>)}</tbody></table></div>
      </section>
      {modal}
    </main>
  );
}
