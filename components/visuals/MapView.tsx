"use client";

// Animated map of a biblical route (RF-M08-02): MapLibre GL over a light base drawn from Natural Earth (no external tile server),
// markers per place, the route drawn step by step, synchronized with the speech through `highlight`, credits always visible.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { MAP_CREDITS, type RouteDef } from "@/lib/visuals/route-data";

export interface MapViewProps {
  route: Pick<RouteDef, "id" | "name" | "steps">;
  /** Place ids the teacher is talking about now (highlight_place_ids). */
  highlight?: string[];
  /** How long the animation takes, in ms (the length of the speech); 0 shows the whole route at once. */
  durationMs?: number;
  onOpenRef?(ref: string): void;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function MapView({ route, highlight = [], durationMs = 9000, onOpenRef }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [shown, setShown] = useState(0);
  const [selected, setSelected] = useState<string | null>(highlight[0] ?? null);
  const steps = route.steps;
  const coords = useMemo(() => steps.map((s) => [s.lon, s.lat] as [number, number]), [steps]);

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          land: { type: "geojson", data: "/maps/land.json" },
          lakes: { type: "geojson", data: "/maps/lakes.json" },
          rivers: { type: "geojson", data: "/maps/rivers.json" },
          path: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "sea", type: "background", paint: { "background-color": "#cfe0e3" } },
          { id: "land", type: "fill", source: "land", paint: { "fill-color": "#efe6d2", "fill-outline-color": "#c9b98f" } },
          { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": "#cfe0e3" } },
          { id: "rivers", type: "line", source: "rivers", paint: { "line-color": "#9fc0c8", "line-width": 1.2 } },
          { id: "path-line", type: "line", source: "path", paint: { "line-color": "#b5532d", "line-width": 3.2, "line-dasharray": [2, 1.4] } },
        ],
      },
      interactive: true,
      cooperativeGestures: false,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const b = new maplibregl.LngLatBounds();
    coords.forEach((c) => b.extend(c));
    m.fitBounds(b, { padding: 56, maxZoom: 8, duration: 0 });
    markers.current = steps.map((s, i) => {
      const div = document.createElement("button");
      div.type = "button";
      div.setAttribute("aria-label", s.name);
      div.className = "map-pin";
      div.textContent = String(i + 1);
      div.addEventListener("click", () => setSelected(s.id));
      return new maplibregl.Marker({ element: div }).setLngLat([s.lon, s.lat]).addTo(m);
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, [coords, steps]);

  // Animation: the route is drawn step by step along the duration (instantly with "reduce motion").
  useEffect(() => {
    const total = steps.length;
    if (reduced() || durationMs <= 0) { setShown(total); return; }
    setShown(1);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / durationMs);
      setShown(Math.max(1, Math.ceil(k * total)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [steps, durationMs]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = m.getSource("path") as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords.slice(0, Math.max(1, shown)) } });
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
    markers.current.forEach((mk, i) => {
      const elm = mk.getElement();
      elm.style.opacity = i < shown ? "1" : "0.25";
      elm.dataset.active = steps[i].id === selected || highlight.includes(steps[i].id) ? "1" : "0";
    });
  }, [shown, coords, steps, selected, highlight]);

  // Highlighted places (what the teacher is saying now) take the camera.
  useEffect(() => {
    const id = highlight[0];
    const s = steps.find((x) => x.id === id);
    if (s && map.current) {
      setSelected(s.id);
      map.current.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.current.getZoom(), 6), duration: reduced() ? 0 : 900 });
    }
  }, [highlight, steps]);

  const sel = steps.find((s) => s.id === selected);
  return (
    <figure className="flex h-full min-h-[320px] flex-col gap-2" aria-label={route.name}>
      <div ref={el} className="min-h-[260px] flex-1 overflow-hidden rounded-control border border-line" role="img" aria-label={t("map.alt").replace("{name}", route.name).replace("{places}", steps.map((s) => s.name).join(", "))} />
      {sel && (
        <div className="rounded-control border border-line bg-surface p-2 text-sm" aria-live="polite">
          <strong>{sel.name}</strong>
          <p>{sel.note}</p>
          <div className="mt-1 flex flex-wrap gap-2">{sel.refs.slice(0, 3).map((r) => <button key={r} type="button" className="rounded-control border border-line px-2 py-1 text-xs underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}</div>
        </div>
      )}
      <ol className="sr-only">{steps.map((s) => <li key={s.id}>{s.name}: {s.note}</li>)}</ol>
      <figcaption className="text-xs text-muted">{MAP_CREDITS}</figcaption>
    </figure>
  );
}
