"use client";

// Immersive environments (Phase 3). The environment travels in the query string (?e=) so the screen stays exportable for Capacitor. Environments
// published from /admin are fetched here, so a new one reaches every student without a new version of the app. Not linked from the menus yet.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getBibleVerses, getEnvironment, listEnvironments, type EnvListItem } from "@/lib/api-client";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { EnvironmentPackage } from "@/lib/immersive/package";
import { getPackage } from "@/lib/immersive/registry";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const ImmersiveView = dynamic(() => import("@/components/immersive/ImmersiveView"), { ssr: false });

export default function ImmersivePage() {
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [pkg, setPkg] = useState<EnvironmentPackage | null>(null);
  const [list, setList] = useState<EnvListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("e"));
    try { const c = document.createElement("canvas"); setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setWebgl(false); }
  }, []);
  useEffect(() => {
    if (id === undefined) return;
    if (!id) { void listEnvironments().then(setList).catch(() => setError(t("imm.notfound"))); return; }
    const local = getPackage(id);
    if (local) { setPkg(local); return; }
    void getEnvironment(id).then((r) => { const p = EnvironmentPackage.safeParse(r.package); if (p.success) setPkg(p.data); else setError(t("imm.notfound")); }).catch(() => setError(t("imm.notfound")));
  }, [id]);
  async function openRef(ref: string) {
    try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses }); }
    catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); }
  }
  if (!webgl) return <main className="p-6"><p role="alert">{t("imm.nowebgl")}</p></main>;
  if (error) return <main className="p-6"><p role="alert">{error}</p></main>;
  if (id === undefined) return <main className="p-6"><p className="text-muted">{t("common.loading")}</p></main>;
  if (!id) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
        <h1 className="text-3xl">{t("imm.list.title")}</h1>
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
