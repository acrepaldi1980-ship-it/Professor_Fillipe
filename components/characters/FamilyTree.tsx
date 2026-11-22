"use client";

// The complete family tree of a person from the Bible's knowledge graph: ancestors above, the person in the middle, descendants below, partners side by side,
// siblings in the person's row; every box opens that person; every link names the passage that gives it. Below the drawing, the same family as a list with passages.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFamilyTree, type FamilyTreeData } from "@/lib/api-client";
import { CURATED } from "@/lib/characters";
import { soft } from "./nav";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const W = 132, H = 46, GX = 18, GY = 64;
const appId = (kg: string) => CURATED.find((c) => c.kgId === kg)?.id ?? `kg:${kg.replace(/^person:/, "")}`;

interface Placed { id: string; name: string; period: string | null; gen: number; x: number; y: number }

function layout(tree: FamilyTreeData): { nodes: Placed[]; width: number; height: number } {
  const rows = new Map<number, FamilyTreeData["nodes"]>();
  for (const n of tree.nodes) (rows.get(n.gen) ?? rows.set(n.gen, []).get(n.gen)!).push(n);
  const gens = [...rows.keys()].sort((a, b) => a - b);
  const parentsOf = new Map<string, string[]>();
  for (const e of tree.edges) (parentsOf.get(e.child) ?? parentsOf.set(e.child, []).get(e.child)!).push(e.parent);
  const partnerOf = new Map<string, string[]>();
  for (const p of tree.partners) { (partnerOf.get(p.a) ?? partnerOf.set(p.a, []).get(p.a)!).push(p.b); (partnerOf.get(p.b) ?? partnerOf.set(p.b, []).get(p.b)!).push(p.a); }
  const pos = new Map<string, number>();
  const order: Record<number, string[]> = {};
  for (const g of gens) {
    const row = rows.get(g)!;
    const key = (n: FamilyTreeData["nodes"][number]): number => {
      const ps = (parentsOf.get(n.id) ?? []).filter((p) => pos.has(p));
      return ps.length ? ps.reduce((t, p) => t + pos.get(p)!, 0) / ps.length : Number.NaN;
    };
    const keyed = row.map((n, i) => ({ n, k: key(n), i }));
    const known = keyed.filter((x) => !Number.isNaN(x.k)).sort((a, b) => a.k - b.k || a.n.name.localeCompare(b.n.name));
    const loose = keyed.filter((x) => Number.isNaN(x.k));
    const seq: string[] = known.map((x) => x.n.id);
    for (const l of loose) { // someone without parents in the drawing goes next to his or her partner, or at the end
      const mate = (partnerOf.get(l.n.id) ?? []).map((m) => seq.indexOf(m)).find((i) => i >= 0);
      if (mate !== undefined) seq.splice(mate + 1, 0, l.n.id); else seq.push(l.n.id);
    }
    // keep every couple side by side
    for (const id of [...seq]) for (const m of partnerOf.get(id) ?? []) { const a = seq.indexOf(id), b = seq.indexOf(m); if (a >= 0 && b >= 0 && Math.abs(a - b) > 1) { seq.splice(b, 1); seq.splice(seq.indexOf(id) + 1, 0, m); } }
    order[g] = seq;
    seq.forEach((id, i) => pos.set(id, i));
  }
  const widest = Math.max(...gens.map((g) => order[g].length));
  const width = Math.max(1, widest) * (W + GX) + GX;
  const placed: Placed[] = [];
  gens.forEach((g, r) => {
    const seq = order[g], off = (width - (seq.length * (W + GX) - GX)) / 2;
    for (let i = 0; i < seq.length; i++) { const n = tree.nodes.find((x) => x.id === seq[i])!; placed.push({ ...n, x: off + i * (W + GX), y: 14 + r * (H + GY) }); }
  });
  return { nodes: placed, width, height: 28 + gens.length * (H + GY) - GY };
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const years = (p: string | null) => (p ? `${p.replace(" a ", " – ").replace(/-(\d)/g, "$1")} a.C.` : "");

export function FamilyTree({ characterId, color, onVerse }: { characterId: string; color: string; onVerse: (ref: string) => void }) {
  const [tree, setTree] = useState<FamilyTreeData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { setTree(null); setError(false); void getFamilyTree(characterId).then(setTree).catch(() => setError(true)); }, [characterId]);
  const lay = useMemo(() => (tree && tree.nodes.length ? layout(tree) : null), [tree]);
  const box = useRef<HTMLElement>(null);
  // open centered on the person: the tree can be much wider than the screen
  useEffect(() => { const f = lay?.nodes.find((n) => n.id === tree?.focus); const el = box.current; if (f && el) { el.scrollLeft = Math.max(0, f.x + W / 2 - el.clientWidth / 2); el.scrollTop = Math.max(0, f.y - 90); } }, [lay, tree]);
  if (error) return <p role="alert" className="text-muted">{t("char.error")}</p>;
  if (!tree) return <p className="text-muted">{t("common.loading")}</p>;
  if (!lay || tree.nodes.length < 2) return <p className="rounded-control border border-line bg-surface p-3 text-sm text-muted">{t("tree.none")}</p>;
  const at = new Map(lay.nodes.map((n) => [n.id, n]));
  const name = (id: string) => at.get(id)?.name ?? id;
  const focus = at.get(tree.focus);
  const list = (title: string, ids: { id: string; refs: string[] }[]) => ids.length > 0 && (
    <div><h3 className="font-semibold">{title}</h3><ul className="flex flex-col gap-1">{ids.map(({ id, refs }) => <li key={id}><Link className="underline" href={`/personagens?id=${encodeURIComponent(appId(id))}`} onClick={soft(`/personagens?id=${encodeURIComponent(appId(id))}`)}>{name(id)}</Link>{at.get(id)?.period ? <span className="text-sm text-muted"> · {years(at.get(id)!.period)}</span> : null}{refs.map((r) => <button key={r} type="button" className="ml-2 text-sm underline" onClick={() => onVerse(r)}>{formatRefPt(r)}</button>)}</li>)}</ul></div>
  );
  const parents = tree.edges.filter((e) => e.child === tree.focus).map((e) => ({ id: e.parent, refs: e.refs }));
  const children = tree.edges.filter((e) => e.parent === tree.focus).map((e) => ({ id: e.child, refs: e.refs }));
  const mates = tree.partners.filter((p) => p.a === tree.focus || p.b === tree.focus).map((p) => ({ id: p.a === tree.focus ? p.b : p.a, refs: p.refs }));
  const grand = tree.edges.filter((e) => children.some((c) => c.id === e.parent)).map((e) => ({ id: e.child, refs: e.refs }));
  const gens = new Set(lay.nodes.map((n) => n.gen));
  return (
    <div className="flex flex-col gap-3">
      <figure ref={box} className="overflow-auto rounded-control border border-line bg-surface p-2" style={{ maxHeight: 560 }}>
        <svg width={lay.width} height={lay.height} role="img" aria-label={t("tree.title")} className="block">
          {tree.edges.map((e) => { const a = at.get(e.parent), b = at.get(e.child); if (!a || !b) return null; const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y; return <path key={`${e.parent}${e.child}`} d={`M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`} stroke={color} strokeWidth="1.6" fill="none" opacity=".65" />; })}
          {tree.partners.map((p) => { const a = at.get(p.a), b = at.get(p.b); if (!a || !b || a.gen !== b.gen) return null; const [l, r] = a.x < b.x ? [a, b] : [b, a]; return <g key={`${p.a}${p.b}`}><path d={`M${l.x + W} ${l.y + H / 2} L${r.x} ${r.y + H / 2}`} stroke="#b3202f" strokeWidth="2" strokeDasharray="4 3" /><text x={(l.x + W + r.x) / 2} y={l.y + H / 2 - 4} textAnchor="middle" fontSize="11" fill="#b3202f">⚭</text></g>; })}
          {lay.nodes.map((n) => (
            <a key={n.id} href={`/personagens?id=${encodeURIComponent(appId(n.id))}`} onClick={soft(`/personagens?id=${encodeURIComponent(appId(n.id))}`)}>
              <rect x={n.x} y={n.y} width={W} height={H} rx="10" fill={n.id === tree.focus ? color : "#fffaf0"} stroke={color} strokeWidth={n.id === tree.focus ? 3 : 1.4} />
              <text x={n.x + W / 2} y={n.y + 19} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={n.id === tree.focus ? "#fff" : "#3a2f27"}>{short(n.name, 17)}</text>
              <text x={n.x + W / 2} y={n.y + 35} textAnchor="middle" fontSize="10" fill={n.id === tree.focus ? "#fff" : "#7a6d60"}>{short(years(n.period), 22)}</text>
            </a>
          ))}
        </svg>
      </figure>
      <p className="text-xs text-muted">{t("tree.legend").replace("{n}", String(tree.nodes.length)).replace("{g}", String(gens.size))}{tree.truncated ? ` ${t("tree.truncated")}` : ""}</p>
      {focus && (
        <div className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3">
          {list(t("tree.parents"), parents)}{list(t("tree.siblings"), tree.siblings)}{list(t("tree.partners"), mates)}{list(t("tree.children"), children)}{list(t("tree.grandchildren"), grand)}
        </div>
      )}
    </div>
  );
}
