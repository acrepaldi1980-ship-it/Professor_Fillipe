"use client";

// Animated map of a biblical route (RF-M08-02): MapLibre GL over a light base drawn from Natural Earth (no external tile server),
// markers per place, the route drawn step by step, synchronized with the speech through `highlight`, credits always visible.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { ERAS, LABELS, PLACES, RELIEF_CREDIT, ROADS, type PlaceType } from "@/lib/visuals/map-world";
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
  const [layers, setLayers] = useState({ relief: true, water: true, names: true, places: true, roads: false });
  const [era, setEra] = useState<string>("");
  const [place, setPlace] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const worldMarkers = useRef<{ el: HTMLElement; minZoom: number; maxZoom: number; kind: "place" | "label" | "road" }[]>([]);
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
          relief: { type: "image", url: "/maps/relief.webp", coordinates: [[5.625, 47.0402], [50.625, 47.0402], [50.625, 21.9430], [5.625, 21.9430]] },
          land: { type: "geojson", data: "/maps/land.json" },
          lakes: { type: "geojson", data: "/maps/lakes.json" },
          rivers: { type: "geojson", data: "/maps/rivers.json" },
          era: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          roads: { type: "geojson", data: { type: "FeatureCollection", features: ROADS.map((r) => ({ type: "Feature", properties: { id: r.id }, geometry: { type: "LineString", coordinates: r.coords } })) } },
          path: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "sea", type: "background", paint: { "background-color": "#cfe0e3" } },
          { id: "relief", type: "raster", source: "relief", paint: { "raster-resampling": "linear", "raster-fade-duration": 0 } },
          { id: "land", type: "line", source: "land", paint: { "line-color": "#8a7a58", "line-width": 0.8, "line-opacity": 0.7 } },
          { id: "lakes", type: "fill", source: "lakes", paint: { "fill-color": "#a9cdd9" } },
          { id: "rivers", type: "line", source: "rivers", paint: { "line-color": "#5f9bb5", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 8, 2] } },
          { id: "era-fill", type: "fill", source: "era", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.24 } },
          { id: "era-line", type: "line", source: "era", paint: { "line-color": ["get", "color"], "line-width": 2.8, "line-dasharray": [3, 2] } },
          { id: "roads", type: "line", source: "roads", layout: { visibility: "none" }, paint: { "line-color": "#6b4a2a", "line-width": 2, "line-dasharray": [1.2, 1.6], "line-opacity": 0.9 } },
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
    // world layers: places by type, names (seas, rivers, regions, ranges) and road names. Shown by zoom level so the map never gets crowded.
    const routeIds = new Set(steps.map((x) => x.id));
    worldMarkers.current = [];
    PLACES.forEach((pl) => {
      if (routeIds.has(pl.id)) return;
      const div = document.createElement("button");
      div.type = "button";
      div.className = `map-place map-place-${pl.type}`;
      div.setAttribute("aria-label", pl.name);
      div.innerHTML = `<i></i><span>${pl.name}</span>`;
      div.addEventListener("click", () => setPlace(pl.id));
      new maplibregl.Marker({ element: div }).setLngLat([pl.lon, pl.lat]).addTo(m);
      worldMarkers.current.push({ el: div, minZoom: pl.minZoom ?? 5, maxZoom: 99, kind: "place" });
    });
    LABELS.forEach((lb) => {
      const div = document.createElement("div");
      div.className = `map-label map-label-${lb.kind}`;
      div.textContent = lb.text;
      new maplibregl.Marker({ element: div }).setLngLat([lb.lon, lb.lat]).addTo(m);
      worldMarkers.current.push({ el: div, minZoom: lb.minZoom, maxZoom: lb.maxZoom ?? 99, kind: "label" });
    });
    ROADS.forEach((rd) => {
      const mid = rd.coords[Math.floor(rd.coords.length / 2)];
      const div = document.createElement("div");
      div.className = "map-label map-label-road";
      div.textContent = rd.name;
      new maplibregl.Marker({ element: div }).setLngLat(mid).addTo(m);
      worldMarkers.current.push({ el: div, minZoom: 5, maxZoom: 99, kind: "road" });
    });
    const sync = () => {
      const z = m.getZoom();
      worldMarkers.current.forEach((w) => { w.el.style.display = z >= w.minZoom && z <= w.maxZoom ? "" : "none"; });
    };
    m.on("zoom", sync);
    m.once("load", sync);
    sync();
    return () => {
      m.remove();
      map.current = null;
    };
  }, [coords, steps]);

  // Layer switches and the era overlay.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const vis = (id: string, on: boolean) => { if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", on ? "visible" : "none"); };
      vis("relief", layers.relief);
      vis("lakes", layers.water);
      vis("rivers", layers.water);
      vis("roads", layers.roads);
      worldMarkers.current.forEach((w) => {
        const hide = (w.kind === "place" && !layers.places) || (w.kind === "label" && !layers.names) || (w.kind === "road" && !layers.roads);
        w.el.dataset.off = hide ? "1" : "0";
      });
      const e = ERAS.find((x) => x.id === era);
      (m.getSource("era") as maplibregl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: e ? e.polys.map((poly) => ({ type: "Feature", properties: { color: e.color }, geometry: { type: "Polygon", coordinates: [[...poly, poly[0]]] } })) : [] });
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
  }, [layers, era]);

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
  const wp = PLACES.find((x) => x.id === place) ?? null;
  const eraDef = ERAS.find((x) => x.id === era) ?? null;
  const typeName: Record<PlaceType, string> = { city: t("map.type.city"), port: t("map.type.port"), mountain: t("map.type.mountain"), site: t("map.type.site"), river: t("map.type.river") };
  const toggles: [keyof typeof layers, string][] = [["relief", t("map.layer.relief")], ["water", t("map.layer.water")], ["names", t("map.layer.names")], ["places", t("map.layer.places")], ["roads", t("map.layer.roads")]];
  return (
    <figure className="flex h-full min-h-[320px] flex-col gap-2" aria-label={route.name}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" aria-expanded={panel} onClick={() => setPanel((v) => !v)} className="min-h-9 rounded-control border border-line bg-surface px-3">{t("map.layers")}</button>
        <label className="flex items-center gap-1"><span className="sr-only">{t("map.era")}</span>
          <select value={era} onChange={(e) => setEra(e.target.value)} aria-label={t("map.era")} className="min-h-9 rounded-control border border-line bg-surface px-2">
            <option value="">{t("map.era.none")}</option>
            {ERAS.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.years})</option>)}
          </select>
        </label>
      </div>
      {panel && <div role="group" aria-label={t("map.layers")} className="flex flex-wrap gap-2">{toggles.map(([k, label]) => <button key={k} type="button" aria-pressed={layers[k]} onClick={() => setLayers((v) => ({ ...v, [k]: !v[k] }))} className={`min-h-9 rounded-control border px-3 text-sm ${layers[k] ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface"}`}>{label}</button>)}</div>}
      {eraDef && <p role="note" className="rounded-control border border-line bg-surface p-2 text-sm"><strong style={{ color: eraDef.color }}>{eraDef.name}</strong> ({eraDef.years}). {eraDef.note} <span className="text-muted">{t("map.era.approx")}</span></p>}
      <div ref={el} className="min-h-[260px] flex-1 overflow-hidden rounded-control border border-line" role="img" aria-label={t("map.alt").replace("{name}", route.name).replace("{places}", steps.map((s) => s.name).join(", "))} />
      {sel && (
        <div className="rounded-control border border-line bg-surface p-2 text-sm" aria-live="polite">
          <strong>{sel.name}</strong>
          <p>{sel.note}</p>
          <div className="mt-1 flex flex-wrap gap-2">{sel.refs.slice(0, 3).map((r) => <button key={r} type="button" className="rounded-control border border-line px-2 py-1 text-xs underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}</div>
        </div>
      )}
      {wp && (
        <div className="rounded-control border border-line bg-surface p-2 text-sm" aria-live="polite" data-testid="place-card">
          <div className="flex items-start justify-between gap-2"><strong>{wp.name}</strong><button type="button" aria-label={t("study.verse.close")} className="px-2" onClick={() => setPlace(null)}>×</button></div>
          <p className="text-xs text-muted">{typeName[wp.type]}</p>
          <p>{wp.note}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {wp.refs.slice(0, 3).map((r) => <button key={r} type="button" className="rounded-control border border-line px-2 py-1 text-xs underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r.split("-")[0])}</button>)}
            {wp.archaeology && <a href={`/arqueologia?p=${wp.archaeology}`} className="rounded-control border border-line px-2 py-1 text-xs underline">{t("map.arch")}</a>}
          </div>
        </div>
      )}
      <ol className="sr-only">{steps.map((s) => <li key={s.id}>{s.name}: {s.note}</li>)}</ol>
      <figcaption className="text-xs text-muted">{MAP_CREDITS} {RELIEF_CREDIT}</figcaption>
    </figure>
  );
}
