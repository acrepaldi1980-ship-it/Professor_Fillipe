"use client";

// Immersive environments (Phase 3). The environment travels in the query string (?e=) so the screen stays exportable for Capacitor. Environments
// published from /admin are fetched here, so a new one reaches every student without a new version of the app. Not linked from the menus yet.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getBibleVerses, getEnvironment, listEnvironments, type EnvListItem } from "@/lib/api-client";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { EnvironmentPackage } from "@/lib/immersive/package";
import { getPackage, getTour, PACKAGES, TOURS } from "@/lib/immersive/registry";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const PanoView = dynamic(() => import("@/components/immersive/PanoView"), { ssr: false });
const ImmersiveView = dynamic(() => import("@/components/immersive/ImmersiveView"), { ssr: false });

export default function ImmersivePage() {
  return <Suspense fallback={<main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>}><ImmersiveScreen /></Suspense>;
}

function ImmersiveScreen() {
  const params = useSearchParams();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [tourId, setTourId] = useState<string | null>(null);
  const [pkg, setPkg] = useState<EnvironmentPackage | null>(null);
  const [list, setList] = useState<EnvListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    setTourId(params.get("t")); setId(params.get("e")); setPkg(null); setError(null);
    try { const c = document.createElement("canvas"); setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setWebgl(false); }
  }, [params]);
  useEffect(() => {
    if (id === undefined || tourId) return;
    if (!id) { void listEnvironments().then((l) => setList([...l, ...Object.values(PACKAGES).filter((c) => !l.some((e) => e.id === c.id)).map((c) => ({ id: c.id, title: c.title, era: c.era, size_bytes: 0, source: "code" as const }))])).catch(() => setError(t("imm.notfound"))); return; }
    const local = getPackage(id);
    if (local) { setPkg(local); return; }
    void getEnvironment(id).then((r) => { const p = EnvironmentPackage.safeParse(r.package); if (p.success) setPkg(p.data); else setError(t("imm.notfound")); }).catch(() => setError(t("imm.notfound")));
  }, [id, tourId]);
  async function openRef(ref: string) {
    try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses }); }
    catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); }
  }
  if (!webgl) return <main className="p-6"><p role="alert">{t("imm.nowebgl")}</p></main>;
  if (error) return <main className="p-6"><p role="alert">{error}</p></main>;
  if (id === undefined) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  const tour = tourId ? getTour(tourId) : undefined;
  if (tour) {
    return (
      <main className="h-[calc(100dvh-4.5rem)] w-full">
        <PanoView key={tour.id} tour={tour} initial={params.get("s") ?? undefined} onOpenRef={(r) => void openRef(r)} />
        {verse && (
          <Modal title={verse.title} onClose={() => setVerse(null)}>
            {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
            <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
          </Modal>
        )}
      </main>
    );
  }
  if (!id) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
        <h1 className="text-3xl">{t("home.imm")}</h1>
        <h2 className="text-xl">{t("imm.panos")}</h2>
        <p className="text-muted">{t("imm.panos.help")}</p>
        <ul className="flex flex-col gap-2">{Object.values(TOURS).map((x) => <li key={x.id}><Link href={`/imersao?t=${x.id}`} className="block rounded-control border border-line bg-surface p-3" data-testid={`tour-${x.id}`}><strong>{x.title}</strong><span className="block text-sm text-muted">{x.era} · {x.scenes.length} {t("pano.places").toLowerCase()}</span></Link></li>)}</ul>
        <h2 className="mt-3 text-xl">{t("imm.list.title")}</h2>
        <p className="text-muted">{t("imm.list.help")}</p>
        <ul className="flex flex-col gap-2">{list.map((e) => <li key={e.id}><Link href={`/imersao?e=${e.id}`} className="block rounded-control border border-line bg-surface p-3"><strong>{e.title}</strong><span className="block text-sm text-muted">{e.era}{e.size_bytes ? ` · ${(e.size_bytes / 1e6).toFixed(1)} MB` : ""}</span></Link></li>)}</ul>
      </main>
    );
  }
  return (
    <main className="h-[calc(100dvh-4.5rem)] w-full">
      {pkg ? <ImmersiveView pkg={pkg} onOpenRef={(r) => void openRef(r)} /> : <p role="status" className="p-6 text-muted">{t("common.loading")}</p>}
      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}
