"use client";

// Reader of the historians' books (Eusebius, Tacitus, Pliny, Suetonius...): table of contents by part, and one unit at a time with previous and next, the same way as
// Josephus. Portuguese when translated (machine translation, said on the page), English public-domain text meanwhile, with a toggle for the original.
import Link from "next/link";
import { useEffect, useState } from "react";
import { soft } from "@/components/characters/nav";
import { getHistToc, getHistUnit, type HistUnit, type HistUnitRef } from "@/lib/api-client";
import { t } from "@/lib/i18n";

type Meta = { id: string; author: string; title: string; edition: string; note: string };

export default function HistReaderPage() {
  const [q, setQ] = useState<{ w: string | null; o: number | null }>({ w: null, o: null });
  const [toc, setToc] = useState<{ work: Meta; units: HistUnitRef[] } | null>(null);
  const [unit, setUnit] = useState<{ work: Meta; unit: HistUnit; prev: { ord: number; label: string } | null; next: { ord: number; label: string } | null } | null>(null);
  const [error, setError] = useState(false);
  const [original, setOriginal] = useState(false);
  useEffect(() => { const sync = () => { const s = new URLSearchParams(window.location.search); setQ({ w: s.get("w"), o: s.get("o") ? Number(s.get("o")) : null }); }; sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  useEffect(() => { setError(false); if (q.w && q.o === null) void getHistToc(q.w).then(setToc).catch(() => setError(true)); }, [q]);
  useEffect(() => { setUnit(null); if (q.w && q.o !== null) void getHistUnit(q.w, q.o).then((r) => { setUnit(r); window.scrollTo({ top: 0 }); }).catch(() => setError(true)); }, [q]);
  const url = (w: string, o?: number) => `/historiadores/ler?w=${w}${o ? `&o=${o}` : ""}`;

  if (!q.w) return <main className="p-4"><Link href="/historiadores" className="underline">{t("hist.back")}</Link></main>;
  if (q.o !== null) {
    const u = unit?.unit;
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
        <Link href={url(q.w)} onClick={soft(url(q.w))} className="self-start text-sm underline">{t("hist.toc")}</Link>
        {error && <p role="alert">{t("char.error")}</p>}
        {!unit && !error && <p className="text-muted">{t("common.loading")}</p>}
        {unit && u && (
          <article className="flex flex-col gap-3">
            <header><p className="text-sm text-muted">{unit.work.title}{u.part ? ` · ${u.part}` : ""}</p><h1 className="font-serif text-2xl font-bold">{u.label}{u.title ? `: ${u.title}` : ""}</h1></header>
            <p className="text-xs text-muted">{u.text_pt ? t("hist.lang.pt") : t("hist.lang.wait")}</p>
            {u.text_pt && <button type="button" className="self-start text-sm underline" onClick={() => setOriginal((o) => !o)}>{original ? t("hist.show.pt") : t("hist.show.en")}</button>}
            <Link href={`/estudo?hu=${unit.work.author}.${unit.work.id}.${u.ord}`} className="self-start rounded-control bg-primary px-3 py-2 text-white">{t("hist.ask.unit")}</Link>
            <div className="flex flex-col gap-3 text-[17px] leading-relaxed" lang={original || !u.text_pt ? "en" : "pt-BR"}>{(original || !u.text_pt ? u.text : u.text_pt).split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
            <nav className="flex justify-between gap-2" aria-label="trechos">
              {unit.prev ? <Link className="rounded-control border border-line bg-surface px-3 py-2" href={url(q.w!, unit.prev.ord)} onClick={soft(url(q.w!, unit.prev.ord))}>← {unit.prev.label}</Link> : <span />}
              {unit.next ? <Link className="rounded-control border border-line bg-surface px-3 py-2" href={url(q.w!, unit.next.ord)} onClick={soft(url(q.w!, unit.next.ord))}>{unit.next.label} →</Link> : <span />}
            </nav>
            <details className="text-xs text-muted"><summary>{t("hist.note")}</summary><p>{unit.work.edition}. {unit.work.note}</p></details>
          </article>
        )}
      </main>
    );
  }
  const parts = new Map<string, HistUnitRef[]>();
  for (const x of toc?.units ?? []) (parts.get(x.part) ?? parts.set(x.part, []).get(x.part)!).push(x);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <Link href="/historiadores" onClick={soft("/historiadores")} className="self-start text-sm underline">{t("hist.back")}</Link>
      {error && <p role="alert">{t("char.error")}</p>}
      {!toc && !error && <p className="text-muted">{t("common.loading")}</p>}
      {toc && <>
        <header><h1 className="font-serif text-2xl font-bold">{toc.work.title}</h1><p className="text-sm text-muted">{toc.work.edition}</p><p className="text-sm">{toc.work.note}</p></header>
        <p className="text-xs text-muted">{t("hist.translated").replace("{n}", String(toc.units.filter((x) => x.translated).length)).replace("{m}", String(toc.units.length))}</p>
        {[...parts].map(([part, us]) => <section key={part} className="flex flex-col gap-1">{part && <h2 className="font-serif text-lg font-bold">{part}</h2>}<ul className="flex flex-wrap gap-2">{us.map((x) => <li key={x.ord}><Link href={url(q.w!, x.ord)} onClick={soft(url(q.w!, x.ord))} title={x.title} className="block rounded-full border border-line bg-surface px-3 py-1 text-sm">{x.label.replace(/^\S+\s/, "") || x.label}</Link></li>)}</ul></section>)}
      </>}
    </main>
  );
}
