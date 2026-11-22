"use client";

// Vida dos Personagens (módulo M18): list of every person of the Bible's knowledge graph (curated illustrated lives first) and the book of one life.
// The open person travels in the query string (?id=) so the screen stays exportable for Capacitor.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FamilyTree } from "@/components/characters/FamilyTree";
import { LifeBook } from "@/components/characters/LifeBook";
import { hash, SceneArt } from "@/components/characters/SceneArt";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getBibleVerses, getCharacter, listCharacters, type CharacterDetail, type CharacterSummary } from "@/lib/api-client";
import { CURATED, autoScene } from "@/lib/characters";
import { ERAS } from "@/lib/characters/schema";
import { defaultBibleVersion, t, type MessageKey } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const firstScene = (id: string) => CURATED.find((c) => c.id === id)?.chapters[0].scene ?? autoScene(id);

function Card({ c }: { c: CharacterSummary }) {
  const scene = firstScene(c.id);
  return (
    <Link href={`/personagens?id=${encodeURIComponent(c.id)}`} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <SceneArt spec={scene} seed={hash(c.id)} className="block h-28 w-full" />
      <div className="flex flex-col gap-0.5 p-3">
        <strong className="font-serif text-lg">{c.name}</strong>
        <span className="text-sm text-muted">{c.title}</span>
        <span className="mt-1 text-xs">{c.tier < 3 ? <span className="rounded-full bg-black/10 px-2 py-0.5">{t("char.curated")} · {t("char.chapters").replace("{n}", String(c.chapters))}</span> : <span className="text-muted">{t("char.card")}</span>}</span>
      </div>
    </Link>
  );
}

const shorten = (s: string) => { const t0 = s.replace(/\uFFFD/g, "").slice(0, 900); if (s.length <= 900) return t0; const i = Math.max(t0.lastIndexOf(". "), t0.lastIndexOf("; ")); return (i > 300 ? t0.slice(0, i + 1) : t0) + (i > 300 ? "" : "…"); };
function GraphCard({ d, onVerse }: { d: Extract<CharacterDetail, { kind: "card" }>; onVerse: (ref: string) => void }) {
  const { entity: e, relations } = d.graph;
  const name = e.name_pt ?? e.name_en;
  const rels = new Map<string, string[]>();
  for (const r of relations) { const k = r.direction === "in" && r.relation === "parent_of" ? "child" : r.relation; const l = rels.get(k) ?? []; l.push(r.name_pt ?? r.name_en); rels.set(k, l); }
  return (
    <article className="flex flex-col gap-4">
      <header className="relative overflow-hidden rounded-2xl text-white" style={{ background: d.color }}><SceneArt spec={autoScene(d.id)} seed={hash(d.id)} className="block h-44 w-full" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4"><h1 className="font-serif text-3xl font-bold">{name}</h1>{e.period && <p className="opacity-90">{e.period.replace(" a ", " a ")} (a.C.)</p>}{e.aliases && e.aliases.length > 0 && <p className="text-sm opacity-90">{e.aliases.slice(0, 4).join(" · ")}</p>}</div></header>
      <p className="rounded-control border border-line bg-surface p-3 text-sm">{t("char.soon")}</p>
      {e.description && <p className="text-[16px] leading-relaxed">{shorten(e.description)}</p>}
      <section><h2 className="font-serif text-xl font-bold">{t("tree.title")}</h2><div className="mt-2"><FamilyTree characterId={d.id} color={d.color} onVerse={onVerse} /></div></section>
      {rels.size > 0 && <section><h2 className="font-serif text-xl font-bold">{t("char.relations")}</h2><ul className="mt-2 flex flex-col gap-1">{[...rels].map(([k, names]) => <li key={k}><span className="font-semibold">{k === "child" ? "filho(a) de" : t(`char.rel.${k}` as MessageKey)}</span>: {names.slice(0, 12).join(", ")}</li>)}</ul></section>}
      {e.refs && e.refs.length > 0 && <section><h2 className="font-serif text-xl font-bold">{t("char.verses")}</h2><div className="mt-2 flex flex-wrap gap-2">{e.refs.slice(0, 30).map((r) => <button key={r} type="button" className="rounded-full border border-line bg-surface px-3 py-1" onClick={() => onVerse(r)}>{formatRefPt(r)}</button>)}</div></section>}
      <p className="text-xs text-muted">{t("char.source")}</p>
    </article>
  );
}

export default function CharactersPage() {
  const [id, setId] = useState<string | null>(null);
  const [list, setList] = useState<CharacterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [era, setEra] = useState("");
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [error, setError] = useState(false);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);

  useEffect(() => { const sync = () => setId(new URLSearchParams(window.location.search).get("id")); sync(); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  const load = useCallback((p: number) => { setError(false); void listCharacters({ q, era, page: p }).then((r) => { setTotal(r.total); setPage(p); setList((prev) => (p === 0 ? r.characters : [...prev, ...r.characters])); }).catch(() => setError(true)); }, [q, era]);
  useEffect(() => { if (!id) { const h = setTimeout(() => load(0), q ? 300 : 0); return () => clearTimeout(h); } }, [id, load, q]);
  useEffect(() => { setDetail(null); if (id) { setError(false); void getCharacter(id).then(setDetail).catch(() => setError(true)); window.scrollTo({ top: 0 }); } }, [id]);
  async function openVerse(ref: string) { try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses.length ? r.verses : [{ ref, text: t("study.verse.error") }] }); } catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); } }

  if (id) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
        <Link href="/personagens" className="self-start text-sm underline" onClick={() => setId(null)}>{t("char.back")}</Link>
        {error && <p role="alert">{t("char.error")}</p>}
        {!detail && !error && <p className="text-muted">{t("common.loading")}</p>}
        {detail?.kind === "curated" && <LifeBook c={detail.character} related={detail.character.crosses.flatMap((s) => { const o = CURATED.find((x) => x.id === s); return o ? [{ id: o.id, name: o.name }] : []; })} />}
        {detail?.kind === "card" && <GraphCard d={detail} onVerse={(r) => void openVerse(r)} />}
        {verse && <Modal title={verse.title} onClose={() => setVerse(null)}>{verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}<Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button></Modal>}
      </main>
    );
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <header><h1 className="font-serif text-3xl font-bold">{t("char.title")}</h1><p className="text-muted">{t("char.subtitle")}</p></header>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("char.search")} aria-label={t("char.search")} className="rounded-control border border-line bg-surface p-3" />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("char.all")}>
        <button type="button" className={`rounded-full border px-3 py-1 ${era === "" ? "border-transparent bg-accent text-white" : "border-line bg-surface"}`} onClick={() => setEra("")}>{t("char.all")}</button>
        {Object.entries(ERAS).map(([k, v]) => <button key={k} type="button" className={`rounded-full border px-3 py-1 ${era === k ? "border-transparent bg-accent text-white" : "border-line bg-surface"}`} onClick={() => setEra(k)}>{v.name}</button>)}
      </div>
      {error && <p role="alert">{t("char.error")}</p>}
      <p className="text-sm text-muted">{t("char.total").replace("{n}", String(total))}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{list.map((c) => <Card key={c.id} c={c} />)}</div>
      {!list.length && !error && <p className="text-muted">{t("char.none")}</p>}
      {list.length < total && !era && <Button type="button" variant="ghost" onClick={() => load(page + 1)}>{t("char.more")}</Button>}
    </main>
  );
}
