"use client";

// The illustrated book of one life: cover, lifeline, chapters (picture + text + narration + passage), family diagram, route diagram, crossing lives and lessons.
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useNarrator } from "@/components/useNarrator";
import { getBibleVerses } from "@/lib/api-client";
import { ERAS, type Character } from "@/lib/characters/schema";
import { defaultBibleVersion, t, type MessageKey } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { hash, SceneArt } from "./SceneArt";

const STAGE_COLORS = ["#b9772f", "#6f7a3a", "#7d4a6e", "#3f6f86", "#8a4a3a", "#5a6f4a", "#9a6a2a", "#4a5a8a"];

function Lifeline({ c, onJump }: { c: Character; onJump: (i: number) => void }) {
  const stages = useMemo(() => [...new Set(c.chapters.map((x) => x.stage))], [c]);
  const n = c.chapters.length, w = 760, pad = 24;
  const x = (i: number) => pad + (n === 1 ? 0 : (i * (w - pad * 2)) / (n - 1));
  return (
    <figure className="overflow-x-auto rounded-control border border-line bg-surface p-3">
      <svg viewBox={`0 0 ${w} 140`} className="min-w-[640px]" role="img" aria-label={t("char.lifeline")}>
        <path d={`M${pad} 60 L${w - pad} 60`} stroke={c.color} strokeWidth="5" strokeLinecap="round" opacity=".35" />
        {c.chapters.map((ch, i) => {
          const col = STAGE_COLORS[stages.indexOf(ch.stage) % STAGE_COLORS.length];
          return (
            <g key={ch.id} className="cursor-pointer" onClick={() => onJump(i)}>
              <circle cx={x(i)} cy="60" r="9" fill={col} stroke="#fffaf0" strokeWidth="3" />
              <text x={x(i)} y="63.5" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">{i + 1}</text>
              {i === 0 && <text x={x(i)} y="30" textAnchor="start" fontSize="11" fill="#4a3f36" fontWeight="700">✶ {t("char.born")}</text>}
              {i === n - 1 && <text x={x(i)} y="30" textAnchor="end" fontSize="11" fill="#4a3f36" fontWeight="700">✝ {t("char.died")}</text>}
              <title>{ch.title}</title>
            </g>
          );
        })}
        {stages.map((s, k) => { const idx = c.chapters.map((ch, i) => (ch.stage === s ? i : -1)).filter((i) => i >= 0); const mid = (x(idx[0]) + x(idx[idx.length - 1])) / 2; const col = STAGE_COLORS[k % STAGE_COLORS.length]; return <g key={s}><path d={`M${x(idx[0]) - 6} 84 L${x(idx[idx.length - 1]) + 6} 84`} stroke={col} strokeWidth="3" strokeLinecap="round" /><text x={Math.min(Math.max(mid, 50), w - 50)} y={k % 2 ? 118 : 104} textAnchor="middle" fontSize="10.5" fill={col} fontWeight="700">{s}</text></g>; })}
      </svg>
    </figure>
  );
}

function Family({ c }: { c: Character }) {
  if (!c.family.length) return null;
  const cx = 380, cy = 90, r = 118;
  return (
    <figure className="overflow-x-auto rounded-control border border-line bg-surface p-3">
      <svg viewBox="0 0 760 190" className="min-w-[620px]" role="img" aria-label={t("char.family")}>
        {c.family.map((k, i) => {
          const a = Math.PI + (i / Math.max(1, c.family.length - 1)) * Math.PI, px = cx + Math.cos(a) * r * 2.6, py = cy + 40 + Math.sin(a) * r * 0.95;
          return (
            <g key={k.name}>
              <path d={`M${cx} ${cy} Q${(cx + px) / 2} ${cy + 30} ${px} ${py}`} stroke={c.color} strokeWidth="2" fill="none" opacity=".5" />
              <rect x={px - 56} y={py - 20} width="112" height="40" rx="10" fill="#fffaf0" stroke={c.color} strokeWidth="1.5" />
              <text x={px} y={py - 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#3a2f27">{k.name}</text>
              <text x={px} y={py + 11} textAnchor="middle" fontSize="10" fill="#7a6d60">{k.rel}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="38" fill={c.color} /><text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{c.name}</text>
      </svg>
    </figure>
  );
}

/** A diagram of the route: the places in the order they appear in the chapters, on a plain parchment (no map tiles needed). */
function Route({ c }: { c: Character }) {
  const order = useMemo(() => { const seen: string[] = []; for (const ch of c.chapters) if (ch.place && !seen.includes(ch.place)) seen.push(ch.place); return seen.map((k) => c.places.find((p) => p.key === k)).filter((p): p is Character["places"][number] => !!p); }, [c]);
  if (order.length < 2) return null;
  const lats = order.map((p) => p.lat), lons = order.map((p) => p.lon);
  const [la0, la1, lo0, lo1] = [Math.min(...lats) - 1, Math.max(...lats) + 1, Math.min(...lons) - 2, Math.max(...lons) + 2];
  const W = 760, H = 300;
  const pt = (p: { lat: number; lon: number }) => [40 + ((p.lon - lo0) / (lo1 - lo0)) * (W - 80), 30 + (1 - (p.lat - la0) / (la1 - la0)) * (H - 60)] as const;
  return (
    <figure className="overflow-x-auto rounded-control border border-line p-3" style={{ background: "linear-gradient(#f3e7c8,#ead9ae)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[620px]" role="img" aria-label={t("char.map")}>
        <path d={order.map((p, i) => `${i ? "L" : "M"}${pt(p).join(" ")}`).join(" ")} stroke={c.color} strokeWidth="3" strokeDasharray="8 6" fill="none" strokeLinecap="round" />
        {order.map((p, i) => { const [x, y] = pt(p); return <g key={p.key}><circle cx={x} cy={y} r="11" fill={c.color} stroke="#fffaf0" strokeWidth="3" /><text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{i + 1}</text><text x={x + 15} y={y + 4} fontSize="12" fontWeight="700" fill="#3a2f27">{p.name}</text></g>; })}
      </svg>
    </figure>
  );
}

export function LifeBook({ c, related }: { c: Character; related: { id: string; name: string }[] }) {
  const { playing, play, stop } = useNarrator();
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const era = ERAS[c.era];
  const jump = (i: number) => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  async function openVerse(ref: string) {
    try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses.length ? r.verses : [{ ref, text: t("study.verse.error") }] }); }
    catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); }
  }
  const first = c.chapters[0];
  return (
    <article className="flex flex-col gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-line" style={{ background: c.color }}>
        <SceneArt spec={first.scene} seed={hash(c.id)} className="block h-56 w-full sm:h-72" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
          <p className="text-xs uppercase tracking-wide opacity-90">{era.name} · {era.span}</p>
          <h1 className="font-serif text-3xl font-bold">{c.name}</h1>
          <p className="text-lg opacity-95">{c.title}</p>
        </div>
      </header>
      <p className="text-[17px] leading-relaxed">{c.summary}</p>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-control border border-line bg-surface p-3"><dt className="font-semibold">✶ {t("char.born")}</dt><dd className="text-muted">{c.born.label}{c.born.ref ? ` (${formatRefPt(c.born.ref)})` : ""}</dd></div>
        <div className="rounded-control border border-line bg-surface p-3"><dt className="font-semibold">✝ {t("char.died")}</dt><dd className="text-muted">{c.died.label}{c.died.ref ? ` (${formatRefPt(c.died.ref)})` : ""}</dd></div>
      </dl>
      <section aria-label={t("char.lifeline")} className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("char.lifeline")}</h2><Lifeline c={c} onJump={jump} /></section>
      <Button type="button" onClick={() => jump(0)}>{t("char.start")}</Button>

      {c.chapters.map((ch, i) => (
        <section key={ch.id} ref={(el) => { refs.current[i] = el; }} className="scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-surface" aria-labelledby={`ch-${ch.id}`}>
          <SceneArt spec={ch.scene} seed={hash(`${c.id}${ch.id}`)} className="block aspect-video w-full" />
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: c.color }}>{ch.stage}</span>
              <span className="text-muted">{t("char.of").replace("{i}", String(i + 1)).replace("{n}", String(c.chapters.length))}</span>
              {ch.when && <span className="text-muted">· {ch.when}</span>}
              <span className="ml-auto rounded bg-black/10 px-2 py-0.5">{t(`char.basis.${ch.basis}` as MessageKey)}</span>
            </div>
            <h3 id={`ch-${ch.id}`} className="font-serif text-2xl font-bold">{ch.title}</h3>
            <p className="text-[17px] leading-relaxed">{ch.text}</p>
            <p className="rounded-control border-l-4 bg-black/5 p-3 italic" style={{ borderColor: c.color }}><span className="not-italic font-semibold">{t("char.question")}: </span>{ch.question}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => (playing === ch.id ? stop() : void play(ch.id, `${ch.title}. ${ch.text} ${ch.question}`))}>{playing === ch.id ? `⏹ ${t("char.stop")}` : `🔊 ${t("char.listen")}`}</Button>
              <Button type="button" variant="ghost" onClick={() => void openVerse(ch.ref)}>📖 {formatRefPt(ch.ref)}</Button>
            </div>
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("char.family")}</h2><Family c={c} /></section>
      <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("char.map")}</h2><Route c={c} /></section>
      {related.length > 0 && <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("char.crosses")}</h2><div className="flex flex-wrap gap-2">{related.map((r) => <Link key={r.id} href={`/personagens?id=${r.id}`} className="rounded-full border border-line bg-surface px-3 py-1.5">{r.name}</Link>)}</div></section>}
      {c.lessons.length > 0 && <section className="flex flex-col gap-2"><h2 className="font-serif text-xl font-bold">{t("char.lessons")}</h2><ul className="flex flex-col gap-2">{c.lessons.map((l) => <li key={l.ref} className="rounded-control border border-line bg-surface p-3">{l.text} <button type="button" className="underline" onClick={() => void openVerse(l.ref)}>{formatRefPt(l.ref)}</button></li>)}</ul></section>}
      <p className="text-xs text-muted">{t("char.art")}</p>
      <Link href="/estudo" className="self-start rounded-control border border-line bg-surface px-3 py-2">{t("char.ask")}</Link>
      {verse && <Modal title={verse.title} onClose={() => setVerse(null)}>{verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}<Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button></Modal>}
    </article>
  );
}
