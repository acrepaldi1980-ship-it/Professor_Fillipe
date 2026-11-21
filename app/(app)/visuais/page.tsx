"use client";

// Visual library: maps and timelines the student can open at any time (the teacher also opens them during the conversation).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VisualPanel } from "@/components/visuals/VisualPanel";
import { ShareCardButton } from "@/components/share/ShareCardButton";
import { getBibleVerses, listVisuals, type CatalogModel } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import type { TeacherResponse } from "@/lib/teacher/schema";

import archItems from "@/lib/archaeology/items.json";
const HAS_ARCH = (archItems as { image?: string }[]).some((x) => x.image);

type Visual = TeacherResponse["visuals"][number];

export default function VisualsPage() {
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [timelines, setTimelines] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Visual | null>(null);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  useEffect(() => {
    void listVisuals().then((r) => { setMaps(r.maps); setTimelines(r.timelines); setModels(r.models); setThemes(r.themes); }).catch(() => undefined);
  }, []);
  const shown = models.filter((m) => (!theme || m.theme === theme) && (!query.trim() || `${m.name} ${m.alt}`.toLowerCase().includes(query.trim().toLowerCase())));
  async function openRef(ref: string) {
    try {
      const r = await getBibleVerses("por_blivre_2018", ref);
      setVerse({ title: formatRefPt(ref), lines: r.verses });
    } catch {
      setVerse({ title: formatRefPt(ref), lines: [{ ref, text: "—" }] });
    }
  }
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-3xl">{t("visuals.title")}</h1>
      <div className="grid grid-cols-2 gap-2">
        {HAS_ARCH && <Link href="/arqueologia" className="rounded-control border border-line bg-surface p-3"><strong>{t("visuals.arch")}</strong><span className="block text-sm text-muted">{t("visuals.arch.open")}</span></Link>}
        <Link href="/curiosidades" className="rounded-control border border-line bg-surface p-3"><strong>{t("cur.title")}</strong><span className="block text-sm text-muted">{t("home.cur.help")}</span></Link>
      </div>
      <section><h2 className="mb-2 text-xl">{t("visuals.maps")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{maps.map((m) => <li key={m.id}><button type="button" className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => setOpen({ kind: "map", map_id: m.id, highlight_place_ids: [] })}>{m.name}</button></li>)}</ul></section>
      <section><h2 className="mb-2 text-xl">{t("visuals.timelines")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{timelines.map((x) => <li key={x.id}><button type="button" className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => setOpen({ kind: "timeline", timeline_id: x.id })}>{x.name}</button></li>)}</ul></section>
      <section><h2 className="mb-2 text-xl">{t("visuals.models")}</h2>
        <div className="mb-2 flex flex-col gap-2">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("visuals.models.search")} aria-label={t("visuals.models.search")} className="min-h-10 rounded-control border border-line bg-bg px-3" />
          <div role="group" aria-label={t("visuals.models")} className="flex flex-wrap gap-2">
            {["", ...themes].map((th) => <button key={th || "all"} type="button" aria-pressed={theme === th} onClick={() => setTheme(th)} className={`min-h-9 rounded-control border px-3 text-sm ${theme === th ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{th || t("visuals.models.theme.all")}</button>)}
          </div>
        </div>
        {shown.length === 0 && <p className="text-sm text-muted">{t("visuals.models.none")}</p>}
        <ul className="grid gap-2 sm:grid-cols-2">{shown.map((x) => <li key={x.id}><button type="button" className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => setOpen({ kind: "model3d", model_id: x.id })}>{x.name}</button></li>)}</ul></section>
      {open && <VisualPanel visual={open} durationMs={7000} onClose={() => setOpen(null)} onOpenRef={(r) => void openRef(r)} />}
      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
          <ShareCardButton text={verse.lines.map((l) => l.text).join(" ")} title={verse.title} credit={t("share.card.credit")} />
          <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}
