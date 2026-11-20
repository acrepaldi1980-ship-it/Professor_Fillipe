"use client";

// Mind map as a diagram (RF-M09-01): the center node in the middle, topics on a ring, details on an outer ring. Always with a text
// alternative (the nodes and links as a list) for screen readers.
import { useMemo } from "react";
import { t } from "@/lib/i18n";

export interface MindMapData {
  nodes: { id: string; label: string; group?: "center" | "topic" | "detail" }[];
  edges: { from: string; to: string; label?: string }[];
}

const W = 640, H = 460;

function wrap(label: string, max = 16): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export function MindMapView({ map }: { map: MindMapData }) {
  const pos = useMemo(() => {
    const center = map.nodes.find((n) => n.group === "center") ?? map.nodes[0];
    const topics = map.nodes.filter((n) => n.id !== center.id && n.group !== "detail");
    const details = map.nodes.filter((n) => n.id !== center.id && n.group === "detail");
    const p = new Map<string, { x: number; y: number; r: number }>();
    p.set(center.id, { x: W / 2, y: H / 2, r: 44 });
    topics.forEach((n, i) => { const a = (i / Math.max(1, topics.length)) * Math.PI * 2 - Math.PI / 2; p.set(n.id, { x: W / 2 + Math.cos(a) * 170, y: H / 2 + Math.sin(a) * 135, r: 36 }); });
    details.forEach((n, i) => { const a = ((i + 0.5) / Math.max(1, details.length)) * Math.PI * 2 - Math.PI / 2; p.set(n.id, { x: W / 2 + Math.cos(a) * 270, y: H / 2 + Math.sin(a) * 195, r: 28 }); });
    return { p, center };
  }, [map]);
  const alt = map.edges.map((e) => `${map.nodes.find((n) => n.id === e.from)?.label} → ${map.nodes.find((n) => n.id === e.to)?.label}`).join("; ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t("mindmap.alt")} ${alt}`} className="w-full rounded-control border border-line bg-surface">
        {map.edges.map((e, i) => { const a = pos.p.get(e.from), b = pos.p.get(e.to); return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line, #cfc4aa)" strokeWidth={2} /> : null; })}
        {map.nodes.map((n) => {
          const q = pos.p.get(n.id);
          if (!q) return null;
          const center = n.id === pos.center.id;
          const lines = wrap(n.label, center ? 14 : 16);
          return (
            <g key={n.id}>
              <ellipse cx={q.x} cy={q.y} rx={q.r + 22} ry={q.r} fill={center ? "var(--primary, #b5532d)" : n.group === "detail" ? "#f1ead6" : "#e3d6b6"} stroke="var(--primary, #b5532d)" strokeWidth={center ? 0 : 1.5} />
              <text x={q.x} y={q.y - ((lines.length - 1) * 7)} textAnchor="middle" fontSize={center ? 14 : 12.5} fontWeight={center ? 700 : 500} fill={center ? "#fff" : "#2e2a24"}>
                {lines.map((l, i) => <tspan key={i} x={q.x} dy={i === 0 ? 0 : 15}>{l}</tspan>)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="sr-only">{map.nodes.map((n) => <li key={n.id}>{n.label}</li>)}</ul>
    </figure>
  );
}
