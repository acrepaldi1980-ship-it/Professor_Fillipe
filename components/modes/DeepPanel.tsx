"use client";

// The deep study document (Aprofundar): summary, context, structure, key words in the original language, how each tradition reads it,
// application, cross-references and bibliography. Researched by the app (see ResearchBar); changed by talking or with "Pedir mudança".
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { downloadSessionPdf, getSessionDocument, type SuggestResult } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { InterlinearTab, VersionsTab } from "./DeepTools";
import { ResearchBar } from "./ResearchBar";

interface Study {
  title?: string; passage?: string; overview?: string; context?: string;
  structure?: { title: string; refs?: string[]; summary?: string }[];
  keywords?: { surface: string; translit?: string | null; lemma?: string | null; strong?: string | null; gloss?: string | null; note?: string }[];
  traditions?: { tradition: string; reading: string; work?: string }[];
  history?: { era: string; summary: string; work?: string }[];
  crossrefs?: string[]; application?: string; bibliography?: { work: string; tradition?: string }[];
}

export function DeepPanel({ sessionId, refreshKey, onOpenRef }: { sessionId: string; refreshKey: number; onOpenRef?: (ref: string) => void }) {
  const [doc, setDoc] = useState<Study>({});
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"study" | "il" | "ver">("study");
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    void getSessionDocument(sessionId).then((r) => { if (mine === seq.current) setDoc((r.doc ?? {}) as Study); }).catch(() => undefined);
  }, [sessionId, refreshKey]);
  // Parallel sections answer in any order: an older answer must not replace a newer document, so every answer triggers a fresh read of the stored one.
  const onResearch = useCallback((r: SuggestResult) => {
    const mine = ++seq.current;
    setDoc((cur) => ({ ...cur, ...((r.doc ?? {}) as Study) }));
    void getSessionDocument(sessionId).then((d) => { if (mine === seq.current) setDoc((d.doc ?? {}) as Study); }).catch(() => undefined);
  }, [sessionId]);
  const chip = (r: string) => <button key={r} type="button" className="rounded-control border border-line px-2 py-1 text-xs underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>;

  return (
    <aside aria-label={t("deep.doc")} className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg">{doc.title ?? t("deep.doc")}</h2>
        <Button type="button" variant="ghost" className="text-sm" onClick={() => void downloadSessionPdf(sessionId).catch(() => setError(true))}>{t("doc.pdf")}</Button>
      </div>
      <div role="tablist" aria-label={t("deep.doc")} className="flex gap-1">
        {(["study", "il", "ver"] as const).map((k) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-9 rounded-control border px-3 text-sm ${tab === k ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{t(`deep.tab.${k}`)}</button>)}
      </div>
      {tab === "il" && <InterlinearTab passage={doc.passage} onOpenRef={onOpenRef} />}
      {tab === "ver" && <VersionsTab passage={doc.passage} />}
      {tab === "study" && <>
      <ResearchBar sessionId={sessionId} mode="deep" onUpdate={onResearch} />
      {doc.overview && <section><h3 className="text-sm font-semibold">{t("deep.f.overview")}</h3><p className="whitespace-pre-line text-sm">{doc.overview}</p></section>}
      {doc.context && <section><h3 className="text-sm font-semibold">{t("deep.f.context")}</h3><p className="whitespace-pre-line text-sm">{doc.context}</p></section>}
      {!!doc.structure?.length && (
        <section><h3 className="text-sm font-semibold">{t("deep.f.structure")}</h3>
          <ol className="list-decimal pl-5 text-sm">{doc.structure.map((s, i) => <li key={i} className="mb-1"><strong>{s.title}</strong>{s.summary ? <> — {s.summary}</> : null}{!!s.refs?.length && <div className="mt-1 flex flex-wrap gap-1">{s.refs.map(chip)}</div>}</li>)}</ol></section>
      )}
      {!!doc.keywords?.length && (
        <section><h3 className="text-sm font-semibold">{t("deep.f.keywords")}</h3>
          <ul className="flex flex-col gap-2 text-sm">{doc.keywords.map((k, i) => <li key={i} className="rounded-control border border-line p-2"><strong lang="grc">{k.surface}</strong>{k.translit ? <span className="text-muted"> ({k.translit})</span> : null}{k.strong ? <span className="text-xs text-muted"> · Strong {k.strong}</span> : null}{k.gloss ? <div className="text-muted">{k.gloss}</div> : null}{k.note ? <div>{k.note}</div> : null}</li>)}</ul></section>
      )}
      {!!doc.traditions?.length && (
        <section><h3 className="text-sm font-semibold">{t("deep.f.traditions")}</h3>
          <ul className="flex flex-col gap-2 text-sm">{doc.traditions.map((x, i) => <li key={i} className="rounded-control border border-line p-2"><strong>{x.tradition}</strong><p>{x.reading}</p>{x.work ? <p className="text-xs text-muted">{t("deep.f.source")}: {x.work}</p> : null}</li>)}</ul></section>
      )}
      {!!doc.history?.length && (
        <section><h3 className="text-sm font-semibold">{t("deep.f.history")}</h3>
          <ul className="flex flex-col gap-2 text-sm">{doc.history.map((h, i) => <li key={i} className="rounded-control border border-line p-2"><strong>{h.era}</strong><p>{h.summary}</p>{h.work ? <p className="text-xs text-muted">{t("deep.f.source")}: {h.work}</p> : null}</li>)}</ul></section>
      )}
      {doc.application && <section><h3 className="text-sm font-semibold">{t("deep.f.application")}</h3><p className="whitespace-pre-line text-sm">{doc.application}</p></section>}
      {!!doc.crossrefs?.length && <section><h3 className="text-sm font-semibold">{t("deep.f.crossrefs")}</h3><div className="flex flex-wrap gap-1">{doc.crossrefs.map(chip)}</div><p className="mt-1 text-xs text-muted">{t("deep.f.crossrefs.src")}</p></section>}
      {!!doc.bibliography?.length && <section><h3 className="text-sm font-semibold">{t("deep.f.bibliography")}</h3><ul className="list-disc pl-5 text-sm">{doc.bibliography.map((b, i) => <li key={i}>{b.work}{b.tradition ? <span className="text-muted"> ({b.tradition})</span> : null}</li>)}</ul>
        <Button type="button" variant="ghost" className="mt-1 text-sm" onClick={() => void getPlatform().share.share({ title: t("deep.f.bibliography"), text: doc.bibliography!.map((b) => b.work).join("\n\n") })}>{t("deep.f.bibliography.copy")}</Button></section>}
      </>}
      {error && <p role="alert" className="text-sm text-danger-ink">{t("consent.error")}</p>}
    </aside>
  );
}
