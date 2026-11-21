"use client";

// Visual panel (RF-M08-01): full screen over the conversation on the phone (the speech keeps playing), side panel on tablet and desktop.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getMapRoute, getTimeline, trackEvent } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import type { TeacherResponse } from "@/lib/teacher/schema";
import type { RouteDef } from "@/lib/visuals/route-data";
import type { TimelineEvent } from "@/lib/visuals/timeline-data";
import { MapView } from "./MapView";
import { IllustrationView } from "./IllustrationView";
import { TimelineView } from "./TimelineView";

// The 3D engine is loaded only when a 3D model is opened.
const Model3DView = dynamic(() => import("./Model3DView"), { ssr: false });

type Visual = TeacherResponse["visuals"][number];

export function VisualPanel({ visual, durationMs, onClose, onOpenRef }: { visual: Visual; durationMs: number; onClose(): void; onOpenRef(ref: string): void }) {
  const [route, setRoute] = useState<Pick<RouteDef, "id" | "name" | "steps"> | null>(null);
  const [tl, setTl] = useState<{ name: string; events: TimelineEvent[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    trackEvent("visual_opened", { kind: visual.kind });
    setFailed(false);
    if (visual.kind === "map") void getMapRoute(visual.map_id).then((r) => setRoute({ id: r.id, name: r.name, steps: r.steps.steps })).catch(() => setFailed(true));
    if (visual.kind === "timeline") void getTimeline(visual.timeline_id).then((r) => setTl({ name: r.name, events: r.events })).catch(() => setFailed(true));
  }, [visual]);

  return (
    <section role="dialog" aria-label={t("visual.panel")} className="fixed inset-0 z-50 flex flex-col gap-2 bg-bg p-3 pb-6 md:inset-y-0 md:left-auto md:w-[46%] md:border-l md:border-line md:shadow-[var(--shadow)]">
      <div className="flex justify-end"><Button type="button" variant="ghost" onClick={onClose}>{t("visual.close")}</Button></div>
      <div className="min-h-0 flex-1 overflow-auto">
        {failed && <p role="alert" className="text-muted">{t("consent.error")}</p>}
        {visual.kind === "map" && route && <MapView key={route.id} route={route} highlight={visual.highlight_place_ids} durationMs={durationMs} onOpenRef={onOpenRef} />}
        {visual.kind === "model3d" && <Model3DView modelId={visual.model_id} onOpenRef={onOpenRef} />}
        {visual.kind === "illustration" && <IllustrationView prompt={visual.prompt} alt={visual.alt} />}
        {visual.kind === "timeline" && tl && <TimelineView name={tl.name} events={tl.events} focus={visual.focus_event_id} onOpenRef={onOpenRef} />}
      </div>
    </section>
  );
}
