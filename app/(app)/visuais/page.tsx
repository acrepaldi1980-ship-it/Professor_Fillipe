"use client";

// Visual library: maps and timelines the student can open at any time (the teacher also opens them during the conversation).
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VisualPanel } from "@/components/visuals/VisualPanel";
import { getBibleVerses, listVisuals } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import type { TeacherResponse } from "@/lib/teacher/schema";

type Visual = TeacherResponse["visuals"][number];

export default function VisualsPage() {
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [timelines, setTimelines] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState<Visual | null>(null);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  useEffect(() => {
    void listVisuals().then((r) => { setMaps(r.maps); setTimelines(r.timelines); setModels(r.models); }).catch(() => undefined);
  }, []);
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
      <section><h2 className="mb-2 text-xl">{t("visuals.maps")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{maps.map((m) => <li key={m.id}><button type="button" className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => setOpen({ kind: "map", map_id: m.id, highlight_place_ids: [] })}>{m.name}</button></li>)}</ul></section>
      <section><h2 className="mb-2 text-xl">{t("visuals.timelines")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{timelines.map((x) => <li key={x.id}><button type="button" className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => setOpen({ kind: "timeline", timeline_id: x.id })}>{x.name}</button></li>)}</ul></section>
      <section><h2 className="mb-2 text-xl">{t("visuals.models")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{models.map((x) => <li key={x.id}><button type="button" className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => setOpen({ kind: "model3d", model_id: x.id })}>{x.name}</button></li>)}</ul></section>
      {open && <VisualPanel visual={open} durationMs={7000} onClose={() => setOpen(null)} onOpenRef={(r) => void openRef(r)} />}
      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}
