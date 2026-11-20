"use client";

// Timeline (RF-M08-03): zoom, clickable events with verses, approximate dates shown with their uncertainty ("c. 30 d.C.", bars for ranges).
import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import type { TimelineEvent } from "@/lib/visuals/timeline-data";

const fmt = (y: number) => (y < 0 ? `${-y} a.C.` : `${y} d.C.`);
export const dateLabel = (e: Pick<TimelineEvent, "year" | "from" | "to">) =>
  e.from !== undefined && e.to !== undefined && e.from !== e.to ? `c. ${fmt(e.from)} a ${fmt(e.to)}` : `c. ${fmt(e.year)}`;

export function TimelineView({ name, events, focus, onOpenRef }: { name: string; events: TimelineEvent[]; focus?: string; onOpenRef?(ref: string): void }) {
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(focus ?? events[0]?.id ?? null);
  const years = events.flatMap((e) => [e.from ?? e.year, e.to ?? e.year]);
  const min = Math.min(...years), max = Math.max(...years);
  const span = Math.max(1, max - min);
  const width = 900 * zoom;
  const x = (y: number) => 40 + ((y - min) / span) * (width - 80);
  // Events close in time are staggered on rows so the labels do not overlap.
  const rows = useMemo(() => {
    const last: number[] = [];
    return events.map((e) => {
      const px = x(e.year);
      let r = 0;
      while (last[r] !== undefined && px - last[r] < 130) r++;
      last[r] = px;
      return r;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, zoom]);
  const sel = events.find((e) => e.id === selected);
  const alt = t("timeline.alt").replace("{name}", name).replace("{events}", events.map((e) => `${e.name} (${dateLabel(e)})`).join("; "));
  return (
    <figure className="flex h-full flex-col gap-2" aria-label={name}>
      <div className="flex items-center gap-2 text-sm"><label htmlFor="tl-zoom">Zoom</label><input id="tl-zoom" type="range" min={1} max={4} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /><span className="text-muted">({t("timeline.uncertain")})</span></div>
      <div className="overflow-x-auto rounded-control border border-line bg-surface" role="img" aria-label={alt}>
        <div className="relative" style={{ width, height: 60 + 54 * (Math.max(...rows) + 1) }}>
          <div className="absolute left-0 right-0 top-8 h-0.5 bg-line" />
          {events.map((e, i) => (
            <div key={e.id}>
              {e.from !== undefined && e.to !== undefined && e.to > e.from && <div aria-hidden className="absolute top-[30px] h-1.5 rounded bg-primary/30" style={{ left: x(e.from), width: Math.max(4, x(e.to) - x(e.from)) }} />}
              <button type="button" aria-pressed={selected === e.id} onClick={() => setSelected(e.id)} className={`absolute max-w-[120px] -translate-x-1/2 rounded-control border px-1.5 py-1 text-left text-xs leading-tight ${selected === e.id ? "border-primary bg-primary text-primary-ink" : "border-line bg-bg"}`} style={{ left: x(e.year), top: 40 + rows[i] * 54 }}>
                {e.name}
              </button>
              <span aria-hidden className="absolute top-[26px] h-3 w-3 -translate-x-1/2 rounded-full bg-primary" style={{ left: x(e.year) }} />
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div className="rounded-control border border-line bg-surface p-2 text-sm" aria-live="polite">
          <strong>{sel.name}</strong> <span className="text-muted">{dateLabel(sel)}</span>
          <p>{sel.note}</p>
          <div className="mt-1 flex flex-wrap gap-2">{sel.refs.slice(0, 3).map((r) => <button key={r} type="button" className="rounded-control border border-line px-2 py-1 text-xs underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}</div>
        </div>
      )}
      <ol className="sr-only">{events.map((e) => <li key={e.id}>{e.name}, {dateLabel(e)}: {e.note}</li>)}</ol>
    </figure>
  );
}
