"use client";

// Immersive environments (Phase 3 preview, Prompt 3.1). The environment travels in the query string (?e=) so the screen stays exportable for Capacitor.
// Not linked from the menus yet: it opens by address while the environments are built.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getBibleVerses } from "@/lib/api-client";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { getPackage, PACKAGES } from "@/lib/immersive/registry";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const ImmersiveView = dynamic(() => import("@/components/immersive/ImmersiveView"), { ssr: false });

export default function ImmersivePage() {
  const [id, setId] = useState<string | null>(null);
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("e") ?? Object.keys(PACKAGES)[0]);
    try { const c = document.createElement("canvas"); setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setWebgl(false); }
  }, []);
  const pkg = id ? getPackage(id) : undefined;
  async function openRef(ref: string) {
    try { const r = await getBibleVerses(defaultBibleVersion(), ref); setVerse({ title: formatRefPt(ref), lines: r.verses }); }
    catch { setVerse({ title: formatRefPt(ref), lines: [{ ref, text: t("study.verse.error") }] }); }
  }
  if (id && !pkg) return <main className="p-6"><p role="alert">{t("imm.notfound")}</p></main>;
  if (!webgl) return <main className="p-6"><p role="alert">{t("imm.nowebgl")}</p></main>;
  return (
    <main className="h-[calc(100dvh-4.5rem)] w-full">
      {pkg && <ImmersiveView pkg={pkg} onOpenRef={(r) => void openRef(r)} />}
      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>)}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)}>{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}
