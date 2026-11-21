"use client";

// Sermon mode: the outline and, beside it, the rehearsal (spec 8.7.3 and 8.7.5).
import { useState } from "react";
import { t } from "@/lib/i18n";
import { DocPanel } from "./DocPanel";
import { RehearsalPanel } from "./RehearsalPanel";

export function SermonPanel({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const [tab, setTab] = useState<"doc" | "rehearsal">("doc");
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label={t("sermon.tab.doc")} className="flex gap-1">
        {(["doc", "rehearsal"] as const).map((k) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-9 rounded-control border px-3 text-sm ${tab === k ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{t(`sermon.tab.${k}`)}</button>)}
      </div>
      {/* The outline stays mounted so an unsaved edit is not lost when the preacher switches tabs. */}
      <div className={tab === "doc" ? "" : "hidden"}><DocPanel sessionId={sessionId} mode="sermon" refreshKey={refreshKey} /></div>
      {tab === "rehearsal" && <aside className="rounded-control border border-line bg-surface p-3"><RehearsalPanel sessionId={sessionId} /></aside>}
    </div>
  );
}
