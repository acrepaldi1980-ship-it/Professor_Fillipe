"use client";

// Archaeology gallery (spec 8.18, RF-M18-01): free photos of pieces and sites tied to the Bible, with period, place, verses, source and credit.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { getBibleVerses } from "@/lib/api-client";
import items from "@/lib/archaeology/items.json";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

type Item = { id: string; name: string; period: string; place: string; lat: number; lng: number; refs: string[]; text: string; wiki: string; note?: string; image?: string; credit?: { title: string; author: string; license: string; page: string } };
const ALL = (items as Item[]).filter((i) => i.image);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ArchaeologyPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Item | null>(null);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const list = useMemo(() => ALL.filter((i) => !q || norm(`${i.name} ${i.place} ${i.period} ${i.text}`).includes(norm(q))), [q]);

  async function openRef(ref: string) {
    for (let a = 0; a < 2; a++) {
      try {
        const r = await getBibleVerses("por_blivre_2018", ref);
        if (r.verses.length) return setVerse({ title: formatRefPt(ref), lines: r.verses });
      } catch { /* retry once */ }
    }
    setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] });
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("arch.title")}</h1>
      <p className="text-muted">{t("arch.help")}</p>
      <input type="search" aria-label={t("arch.search")} placeholder={t("arch.search")} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-control border border-line bg-surface px-3" />
      {list.length === 0 && <p role="status" className="text-muted">{t("arch.empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => setOpen(i)} className="flex h-full w-full flex-col overflow-hidden rounded-control border border-line bg-surface text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.image} alt={`${i.name}, ${i.place}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <span className="flex flex-col gap-0.5 p-3"><strong>{i.name}</strong><span className="text-sm text-muted">{i.period} · {i.place}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("arch.credits")}</p>

      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.image} alt={`${open.name}, ${open.place}`} className="mb-2 w-full rounded-control" />
          <p className="text-sm text-muted">{open.period} · {open.place}</p>
          <p className="my-2 text-[17px] leading-relaxed">{open.text}</p>
          {open.note && <p role="note" className="mb-2 rounded-control border border-line p-2 text-sm"><strong>{t("arch.note")}</strong> {open.note}</p>}
          <div className="mb-2 flex flex-wrap gap-2">{open.refs.map((r) => <Button key={r} type="button" variant="ghost" onClick={() => void openRef(r)}>{formatRefPt(r)}</Button>)}</div>
          <Card className="text-xs text-muted">
            <p>{t("arch.source")}: <a className="underline" href={open.wiki} target="_blank" rel="noreferrer">{t("arch.source.wiki")}</a></p>
            {open.credit && <p>{t("arch.photo")}: <a className="underline" href={open.credit.page} target="_blank" rel="noreferrer">{open.credit.title}</a>, {open.credit.author || "autor não informado"}, {open.credit.license}</p>}
          </Card>
          <Button type="button" variant="ghost" onClick={() => setOpen(null)} className="mt-2">{t("study.verse.close")}</Button>
        </Modal>
      )}
      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}
