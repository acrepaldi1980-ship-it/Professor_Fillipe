"use client";

// Illustrated scene engine for "Vida dos Personagens": a static, storybook-style picture drawn in code (no image files, no animation, no cost).
// Layers: sky by time of day, sun/moon/stars, hand-painted hills (rough edges), the biome's ground, features (trees, tents, altars...), figures and a paper grain.
// RA-20: nobody has a face. Jesus is always seen from behind and small, with a halo of light; God is only a ray of light from above.
import { useId, useMemo } from "react";
import type { SceneSpec } from "@/lib/characters/schema";

type Spec = SceneSpec;
const W = 800, H = 450, HORIZON = 285;
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
export const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const SKY: Record<Spec["time"], [string, string, string]> = {
  dawn: ["#7f77b3", "#f0a98f", "#fbdcae"], day: ["#79bde8", "#bfe3f5", "#f6f0d8"], dusk: ["#38457f", "#cf6a8c", "#f7b46e"], night: ["#0a1230", "#1a2a5a", "#364a86"],
};
const BIOME: Record<Spec["biome"], { far: string; mid: string; ground: string; near: string }> = {
  desert: { far: "#d9b58a", mid: "#e2c08e", ground: "#e8cd9c", near: "#d7b27a" },
  pasture: { far: "#9bb98a", mid: "#86ab6f", ground: "#7fa563", near: "#6b934f" },
  mountain: { far: "#8e8aa3", mid: "#6f7a6b", ground: "#7d8a64", near: "#66714f" },
  river: { far: "#a2bf93", mid: "#86ad76", ground: "#8cb27a", near: "#72995f" },
  sea: { far: "#8aa8c2", mid: "#6f97b8", ground: "#d9c79c", near: "#c9b583" },
  city: { far: "#c9b79b", mid: "#bda78a", ground: "#c4ae8c", near: "#aa946f" },
  wilderness: { far: "#c7a97f", mid: "#b8956a", ground: "#c3a273", near: "#a98856" },
  field: { far: "#c9c27d", mid: "#b8b565", ground: "#bfb86a", near: "#a6a255" },
  inside: { far: "#8b6d4a", mid: "#6e5238", ground: "#8a6a47", near: "#6a4d33" },
  garden: { far: "#8fbf86", mid: "#6fae6b", ground: "#79b36c", near: "#5f9a58" },
};
const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

function ridge(seed: number, base: number, amp: number, step = 60): string {
  const r = rng(seed); let d = `M-20 ${H} L-20 ${base}`; let px = -20, py = base;
  for (let x = step - 20; x <= W + step; x += step) { const y = base - r() * amp; d += ` Q${(px + x) / 2} ${py - amp * 0.35 * r()} ${x} ${y}`; px = x; py = y; }
  return d + ` L${W + 40} ${H} Z`;
}

// ---- features: each is drawn at the origin (the ground point) and scaled/placed by the caller
const tree = (v: string, c: string) => {
  switch (v) {
    case "palm": return <g><path d="M-3 0 Q-5 -40 2 -78 L7 -78 Q2 -40 4 0Z" fill="#7a5a3a" />{[-60, -30, 0, 30, 60].map((a) => <path key={a} d={`M3 -78 Q${3 + Math.sin((a * Math.PI) / 180) * 40} ${-96 - Math.cos((a * Math.PI) / 180) * 8} ${3 + Math.sin((a * Math.PI) / 180) * 60} ${-72 + Math.abs(a) * 0.3}`} stroke="#4c7a3c" strokeWidth="7" fill="none" strokeLinecap="round" />)}</g>;
    case "olive": return <g><path d="M-3 0 Q-8 -20 -2 -40 L5 -40 Q2 -20 5 0Z" fill="#6b5a45" /><ellipse cx="0" cy="-52" rx="30" ry="22" fill="#8da06a" /><ellipse cx="-12" cy="-46" rx="18" ry="13" fill="#a4b57f" opacity=".8" /></g>;
    case "cedar": return <g><rect x="-3" y="-14" width="6" height="14" fill="#6b4a32" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${-34 + i * 5} ${-14 - i * 22} L0 ${-44 - i * 22} L${34 - i * 5} ${-14 - i * 22}Z`} fill={i % 2 ? "#3f6b46" : "#4b7b52"} />)}</g>;
    case "fig": return <g><path d="M-3 0 Q-6 -16 0 -30 L6 -30 Q2 -16 5 0Z" fill="#6b5a45" /><circle cx="0" cy="-46" r="26" fill="#6f9a52" /><circle cx="-14" cy="-38" r="15" fill="#86b064" opacity=".85" /><circle cx="12" cy="-36" r="3" fill="#7a4a8a" /></g>;
    default: return <g><path d="M-5 0 Q-9 -26 -3 -50 L7 -50 Q3 -26 7 0Z" fill="#5f4630" /><circle cx="0" cy="-64" r="30" fill={c} /><circle cx="-16" cy="-52" r="20" fill={shade(c, 1.12)} opacity=".8" /></g>;
  }
};
const FEATURE: Record<string, (c: string) => React.ReactNode> = {
  palm: () => tree("palm", ""), olive: () => tree("olive", ""), cedar: () => tree("cedar", ""), fig: () => tree("fig", ""), oak: (c) => tree("oak", c === "dark" ? "#3f6a3c" : "#5f8f4a"),
  tent: () => <g><path d="M-46 0 L0 -50 L46 0Z" fill="#9a7a56" /><path d="M-10 0 L0 -30 L10 0Z" fill="#3b2a1c" /><path d="M-46 0 L0 -50" stroke="#6b4f33" strokeWidth="3" /><path d="M0 -50 L46 0" stroke="#6b4f33" strokeWidth="3" /></g>,
  altar: () => <g><rect x="-24" y="-26" width="48" height="26" fill="#a39a88" /><rect x="-28" y="-30" width="56" height="6" fill="#b6ad9a" />{[-26, 26].map((x) => <path key={x} d={`M${x - 3} -30 L${x} -40 L${x + 3} -30Z`} fill="#b6ad9a" />)}</g>,
  fire: () => <g><path d="M-14 0 L14 0 L8 -6 L-8 -6Z" fill="#5a4630" /><path d="M0 -8 Q-16 -22 -4 -42 Q-2 -28 8 -34 Q14 -16 0 -8Z" fill="#f08a2c" /><path d="M0 -8 Q-8 -18 0 -30 Q8 -18 0 -8Z" fill="#ffd45a" /></g>,
  flock: () => <g>{[[-30, 0], [-8, 6], [14, -2], [34, 5], [0, -8]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}><ellipse cx="0" cy="-9" rx="11" ry="8" fill="#f2eee4" /><circle cx="10" cy="-12" r="4.5" fill="#4a3f36" /><rect x="-6" y="-3" width="2.5" height="6" fill="#4a3f36" /><rect x="4" y="-3" width="2.5" height="6" fill="#4a3f36" /></g>)}</g>,
  camel: () => <g><ellipse cx="0" cy="-26" rx="22" ry="11" fill="#b58a56" /><path d="M-10 -34 Q-4 -50 2 -34Z" fill="#a47a48" /><path d="M16 -30 Q28 -44 30 -52 L36 -50 Q34 -38 24 -26Z" fill="#b58a56" />{[-14, -6, 8, 16].map((x) => <rect key={x} x={x} y="-18" width="3.5" height="18" fill="#9a7444" />)}</g>,
  donkey: () => <g><ellipse cx="0" cy="-20" rx="18" ry="9" fill="#8a8178" /><path d="M14 -24 L26 -34 L30 -28 L22 -18Z" fill="#8a8178" /><path d="M24 -34 L24 -44 L28 -34Z" fill="#8a8178" />{[-10, -4, 8, 14].map((x) => <rect key={x} x={x} y="-12" width="3" height="12" fill="#6f675f" />)}</g>,
  well: () => <g><ellipse cx="0" cy="-12" rx="22" ry="7" fill="#6b655b" /><rect x="-22" y="-12" width="44" height="12" fill="#9a9384" /><ellipse cx="0" cy="-12" rx="17" ry="4.5" fill="#2e3b4a" /></g>,
  boat: () => <g><path d="M-44 -14 L44 -14 L30 4 L-30 4Z" fill="#7a5a3a" /><rect x="-2" y="-62" width="4" height="48" fill="#5a4630" /><path d="M2 -60 L34 -22 L2 -22Z" fill="#efe6d2" /></g>,
  wall: () => <g><rect x="-70" y="-46" width="140" height="46" fill="#b9a487" />{[-62, -42, -22, -2, 18, 38, 58].map((x) => <rect key={x} x={x} y="-56" width="12" height="10" fill="#b9a487" />)}</g>,
  gate: () => <g><rect x="-34" y="-70" width="68" height="70" fill="#b3a083" /><path d="M-16 0 L-16 -34 Q0 -56 16 -34 L16 0Z" fill="#3b2d20" />{[-30, 22].map((x) => <rect key={x} x={x} y="-80" width="10" height="12" fill="#b3a083" />)}</g>,
  temple: () => <g><rect x="-60" y="-8" width="120" height="8" fill="#d8ccb2" /><rect x="-52" y="-62" width="104" height="54" fill="#e6dcc3" />{[-44, -24, -4, 16, 36].map((x) => <rect key={x} x={x} y="-60" width="8" height="52" fill="#cfc3a6" />)}<path d="M-58 -62 L0 -92 L58 -62Z" fill="#c9bb9b" /></g>,
  throne: () => <g><rect x="-20" y="-30" width="40" height="30" fill="#c79a2c" /><rect x="-22" y="-70" width="44" height="42" fill="#d9ac38" /><rect x="-26" y="-74" width="52" height="8" fill="#e6bf4e" /></g>,
  bars: () => <g>{[-60, -40, -20, 0, 20, 40, 60].map((x) => <rect key={x} x={x - 2.5} y="-120" width="5" height="120" fill="#2b2b30" />)}<rect x="-64" y="-124" width="128" height="6" fill="#2b2b30" /></g>,
  cave: () => <g><path d="M-60 0 Q-58 -70 0 -84 Q58 -70 60 0Z" fill="#6d6455" /><path d="M-32 0 Q-30 -44 0 -52 Q30 -44 32 0Z" fill="#1c1812" /></g>,
  ark: () => <g><path d="M-64 -20 L64 -20 L52 8 L-52 8Z" fill="#7a5233" /><rect x="-46" y="-52" width="92" height="32" fill="#946a42" /><path d="M-52 -52 L0 -72 L52 -52Z" fill="#6f4a2c" /><rect x="-8" y="-40" width="16" height="20" fill="#2b1d12" /></g>,
  tablets: () => <g><rect x="-18" y="-40" width="17" height="38" rx="8" fill="#b7b0a0" /><rect x="1" y="-40" width="17" height="38" rx="8" fill="#c4bdae" />{[-30, -22, -14, -6].map((y) => <g key={y}><rect x="-14" y={y} width="9" height="2" fill="#7e7767" /><rect x="5" y={y} width="9" height="2" fill="#7e7767" /></g>)}</g>,
  lamp: () => <g><path d="M-14 0 Q-10 -12 10 -10 L16 -16 L14 -6 Q10 4 -14 0Z" fill="#c79a2c" /><path d="M16 -16 Q22 -26 16 -32 Q12 -24 16 -16Z" fill="#ffcf4a" /></g>,
  scroll: () => <g><rect x="-22" y="-26" width="44" height="26" rx="4" fill="#ecdfbd" /><rect x="-26" y="-28" width="8" height="30" rx="4" fill="#c9b68a" /><rect x="18" y="-28" width="8" height="30" rx="4" fill="#c9b68a" />{[-18, -11, -4].map((y) => <rect key={y} x="-14" y={y} width="28" height="2" fill="#8a7a58" />)}</g>,
  bread: () => <g>{[-14, 4, 22].map((x) => <ellipse key={x} cx={x} cy="-6" rx="9" ry="6" fill="#c9954a" />)}</g>,
  crown: () => <g><path d="M-18 0 L-22 -20 L-10 -10 L0 -26 L10 -10 L22 -20 L18 0Z" fill="#e0b23a" /><rect x="-18" y="-3" width="36" height="5" fill="#c79a2c" /></g>,
  sword: () => <g><rect x="-2" y="-52" width="4" height="40" fill="#cfd4da" /><rect x="-10" y="-14" width="20" height="4" fill="#8a6a3a" /><rect x="-2" y="-10" width="4" height="12" fill="#6b4a2a" /></g>,
  sling: () => <g><path d="M-16 -22 Q0 -10 16 -26" stroke="#7a5a3a" strokeWidth="3" fill="none" /><circle cx="18" cy="-28" r="5" fill="#8a8478" /></g>,
  harp: () => <g><path d="M-14 0 Q-18 -36 0 -52 Q8 -30 14 0Z" fill="#a9772e" stroke="#7a5420" strokeWidth="3" />{[-8, -3, 2, 7].map((x) => <line key={x} x1={x} y1="-8" x2={x + 4} y2="-44" stroke="#f0e6c8" strokeWidth="1.5" />)}</g>,
  net: () => <g><path d="M-40 -34 Q0 -50 40 -34 L30 0 L-30 0Z" fill="none" stroke="#b9a98a" strokeWidth="2" />{[-20, -6, 8, 22].map((x) => <line key={x} x1={x} y1="-40" x2={x * 0.8} y2="0" stroke="#b9a98a" strokeWidth="1.5" />)}</g>,
  vine: () => <g><rect x="-2" y="-40" width="4" height="40" fill="#6b5a45" /><path d="M-30 -40 L30 -40" stroke="#6b5a45" strokeWidth="4" />{[-22, -8, 10, 24].map((x, i) => <g key={x}><circle cx={x} cy="-34" r="9" fill="#78a35a" /><circle cx={x + 4} cy="-24" r="4" fill={i % 2 ? "#6a3a7a" : "#7a4a8a"} /></g>)}</g>,
  wheat: () => <g>{[-24, -14, -4, 6, 16, 26].map((x) => <g key={x}><path d={`M${x} 0 L${x + 1} -40`} stroke="#c9a84a" strokeWidth="2" /><ellipse cx={x + 1} cy="-44" rx="3" ry="8" fill="#d9b44c" /></g>)}</g>,
  stones: () => <g>{[[-20, 0, 12], [0, 2, 16], [22, 0, 10]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y - r / 2} rx={r} ry={r * 0.6} fill="#9c9486" />)}</g>,
  rainbow: () => <g>{["#d94a4a", "#e8903a", "#e8cf4a", "#5aa55a", "#4a88c9", "#7a5ab0"].map((c, i) => <path key={c} d={`M${-110 + i * 6} 0 Q0 ${-150 + i * 6} ${110 - i * 6} 0`} stroke={c} strokeWidth="7" fill="none" opacity=".75" />)}</g>,
  lightning: () => <g><path d="M0 -140 L-16 -70 L0 -76 L-12 0 L22 -84 L4 -80 L16 -140Z" fill="#fff6b0" opacity=".95" /></g>,
  star: () => <g><path d="M0 -14 L3.5 -4 L14 -4 L5.5 2 L8.5 12 L0 6 L-8.5 12 L-5.5 2 L-14 -4 L-3.5 -4Z" fill="#ffe27a" /></g>,
  tower: () => <g><rect x="-22" y="-120" width="44" height="120" fill="#b49a76" />{[-18, -4, 10].map((x) => <rect key={x} x={x} y="-130" width="9" height="10" fill="#b49a76" />)}<rect x="-6" y="-80" width="12" height="20" fill="#3b2d20" /></g>,
  house: () => <g><rect x="-34" y="-40" width="68" height="40" fill="#d6c4a0" /><rect x="-38" y="-46" width="76" height="8" fill="#b9a584" /><rect x="-7" y="-26" width="14" height="26" fill="#4a3624" /><rect x="14" y="-32" width="10" height="10" fill="#4a3624" /></g>,
  bush: () => <g><ellipse cx="0" cy="-14" rx="26" ry="14" fill="#6b8f4f" /><ellipse cx="0" cy="-20" rx="16" ry="20" fill="#ff9a2c" opacity=".92" /><ellipse cx="0" cy="-22" rx="8" ry="14" fill="#ffd45a" /></g>,
  cross_far: () => <g><rect x="-3" y="-64" width="6" height="64" fill="#5a4630" /><rect x="-20" y="-50" width="40" height="6" fill="#5a4630" /></g>,
  fish: () => <g><ellipse cx="0" cy="-8" rx="18" ry="8" fill="#8fb0c9" /><path d="M16 -8 L28 -16 L28 0Z" fill="#7a9ab5" /><circle cx="-9" cy="-10" r="1.8" fill="#223" /></g>,
  chariot: () => <g><rect x="-22" y="-30" width="44" height="18" fill="#a07838" /><circle cx="-12" cy="-8" r="12" fill="none" stroke="#5a4630" strokeWidth="4" /><circle cx="12" cy="-8" r="12" fill="none" stroke="#5a4630" strokeWidth="4" /></g>,
  ladder: () => <g><rect x="-14" y="-140" width="4" height="140" fill="#cfe6ff" opacity=".85" /><rect x="10" y="-140" width="4" height="140" fill="#cfe6ff" opacity=".85" />{[-120, -96, -72, -48, -24].map((y) => <rect key={y} x="-14" y={y} width="28" height="3" fill="#e8f2ff" opacity=".85" />)}</g>,
  coffin: () => <g><path d="M-30 0 L-24 -18 L24 -18 L30 0Z" fill="#8a6a45" /><rect x="-26" y="-22" width="52" height="6" fill="#a8845a" /></g>,
  table: () => <g><rect x="-36" y="-26" width="72" height="6" fill="#8a6a45" /><rect x="-32" y="-20" width="5" height="20" fill="#6b4f33" /><rect x="27" y="-20" width="5" height="20" fill="#6b4f33" /></g>,
  scales: () => <g><rect x="-2" y="-56" width="4" height="56" fill="#8a6a45" /><path d="M-34 -50 L34 -50" stroke="#8a6a45" strokeWidth="3" /><path d="M-34 -50 Q-34 -34 -20 -34 Q-6 -34 -6 -50" fill="#d9ac38" /><path d="M6 -50 Q6 -34 20 -34 Q34 -34 34 -50" fill="#d9ac38" /></g>,
  dove: () => <g><ellipse cx="0" cy="-20" rx="12" ry="6" fill="#fbfbf4" /><path d="M-4 -22 Q-16 -40 -26 -30 Q-14 -24 -6 -18Z" fill="#fbfbf4" /><path d="M10 -22 Q16 -30 20 -26 L12 -18Z" fill="#fbfbf4" /><circle cx="11" cy="-24" r="1.6" fill="#333" /></g>,
};

// ---- people: simple, faceless figures
const SKIN = ["#d9a77a", "#c58f63", "#b57d52", "#e0b88e"];
function Person({ f, seed }: { f: Spec["figures"][number]; seed: number }) {
  const r = rng(seed); const skin = SKIN[Math.floor(r() * SKIN.length)];
  const robe = f.robe ?? ({ man: "#a9744a", woman: "#7a4a6e", child: "#d9a24a", elder: "#d8d0bd", warrior: "#6b3b36", king: "#7d2a5c", priest: "#f1ece0", shepherd: "#8b6b45", jesus: "#f4f0e6", angel: "#fdfcf4", crowd: "#a9744a" } as Record<string, string>)[f.kind];
  const sc = f.kind === "child" ? 0.62 : f.kind === "crowd" ? 0.9 : 1;
  const back = f.pose === "back" || f.kind === "jesus";
  const head = (cy: number) => <g><circle cx="0" cy={cy} r="9" fill={skin} />{f.kind === "king" ? <path d="M-8 -3 L-10 -15 L-4 -9 L0 -17 L4 -9 L10 -15 L8 -3Z" fill="#e0b23a" transform={`translate(0 ${cy + 1})`} /> : f.kind === "priest" ? <rect x="-9" y={cy - 11} width="18" height="7" rx="3" fill="#f6f1e4" /> : f.kind === "angel" ? null : <path d={`M-10 ${cy - 1} Q0 ${cy - 16} 10 ${cy - 1} L10 ${cy + 5} Q0 ${cy - 2} -10 ${cy + 5}Z`} fill={shade(robe, 0.8)} />}{back ? <circle cx="0" cy={cy} r="9" fill={shade(robe, 0.9)} opacity=".35" /> : null}</g>;
  const body = (() => {
    switch (f.pose) {
      case "kneel": return <g><path d="M-14 0 L-10 -30 Q0 -40 10 -30 L16 0Z" fill={robe} />{head(-46)}<path d="M-4 -34 L10 -26" stroke={shade(robe, 0.8)} strokeWidth="5" strokeLinecap="round" /></g>;
      case "raise": return <g><path d="M-14 0 L-8 -50 L8 -50 L14 0Z" fill={robe} />{head(-62)}<path d="M-8 -48 L-18 -76 M8 -48 L18 -76" stroke={skin} strokeWidth="5" strokeLinecap="round" /></g>;
      case "sit": return <g><path d="M-16 0 L-10 -28 L10 -28 L16 0Z" fill={robe} />{head(-40)}</g>;
      case "lie": return <g transform="rotate(-90) translate(0 -2)"><path d="M-14 0 L-8 -50 L8 -50 L14 0Z" fill={robe} />{head(-62)}</g>;
      case "walk": return <g><path d="M-12 0 L-8 -52 L8 -52 L14 0Z" fill={robe} />{head(-64)}<path d="M-9 -44 L-16 -26" stroke={skin} strokeWidth="5" strokeLinecap="round" /></g>;
      default: return <g><path d="M-13 0 L-8 -52 L8 -52 L13 0Z" fill={robe} />{head(-64)}<path d="M-9 -46 L-12 -26 M9 -46 L12 -26" stroke={skin} strokeWidth="5" strokeLinecap="round" /></g>;
    }
  })();
  const staff = f.kind === "shepherd" || f.kind === "elder" || f.holds === undefined && f.pose === "walk";
  return (
    <g transform={`scale(${sc * f.s})`}>
      {f.kind === "jesus" && <ellipse cx="0" cy="-48" rx="34" ry="52" fill="#fff6c8" opacity=".35" />}
      {f.kind === "angel" && <g><path d="M-8 -50 Q-40 -86 -50 -50Z" fill="#fff" opacity=".9" /><path d="M8 -50 Q40 -86 50 -50Z" fill="#fff" opacity=".9" /></g>}
      {body}
      {staff && <rect x="16" y="-72" width="3.5" height="72" fill="#6b4a2a" />}
      {f.holds ? <g transform="translate(20 -6) scale(.55)">{FEATURE[f.holds]?.("")}</g> : null}
    </g>
  );
}

const placeY = (z: number) => HORIZON + 6 + z * 120;
const placeS = (z: number) => 0.55 + z * 0.95;

export function SceneArt({ spec, seed = 1, className, light = false }: { spec: Spec; seed?: number; className?: string; light?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const sky = SKY[spec.time], bio = BIOME[spec.biome];
  const night = spec.time === "night", storm = spec.weather === "storm", fog = spec.weather === "fog";
  const stars = useMemo(() => { const r = rng(seed * 7); return Array.from({ length: 46 }, () => [r() * W, r() * (HORIZON - 40), 0.6 + r() * 1.4] as const); }, [seed]);
  const clouds = useMemo(() => { const r = rng(seed * 13); return Array.from({ length: 5 }, () => [r() * W, 30 + r() * 120, 0.7 + r() * 0.9] as const); }, [seed]);
  const rain = useMemo(() => { const r = rng(seed * 3); return Array.from({ length: 90 }, () => [r() * W, r() * H] as const); }, [seed]);
  const items = [
    ...spec.features.map((f, i) => ({ z: f.z, node: <g key={`f${i}`} transform={`translate(${(f.x / 100) * W} ${placeY(f.z)}) scale(${placeS(f.z) * f.s})`}>{FEATURE[f.kind]?.(night ? "dark" : "")}</g> })),
    ...spec.figures.map((f, i) => ({ z: f.z + 0.01, node: <g key={`p${i}`} transform={`translate(${(f.x / 100) * W} ${placeY(f.z)}) scale(${placeS(f.z)})`}><ellipse cx="0" cy="2" rx="18" ry="4" fill="#000" opacity=".18" /><Person f={f} seed={seed * 31 + i} /></g> })),
  ].sort((a, b) => a.z - b.z);
  const dim = night ? 0.55 : storm ? 0.7 : spec.time === "dusk" ? 0.85 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={storm ? shade(sky[0], 0.6) : sky[0]} /><stop offset=".6" stopColor={storm ? shade(sky[1], 0.65) : sky[1]} /><stop offset="1" stopColor={sky[2]} /></linearGradient>
        <filter id={`rough${uid}`} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed={seed % 90} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="9" /></filter>
        <filter id={`grain${uid}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed % 50} /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0" /></filter>
        <radialGradient id={`vig${uid}`} cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#1b1208" stopOpacity=".55" /></radialGradient>
        <radialGradient id={`sun${uid}`}><stop offset="0" stopColor="#fff7d6" stopOpacity="1" /><stop offset="1" stopColor="#fff7d6" stopOpacity="0" /></radialGradient>
        <linearGradient id={`ray${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6c8" stopOpacity=".9" /><stop offset="1" stopColor="#fff6c8" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky${uid})`} />
      {night && stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity=".85" />)}
      {night ? <g><circle cx="620" cy="90" r="26" fill="#f4efd8" /><circle cx="632" cy="84" r="24" fill={sky[0]} opacity=".55" /></g>
        : <g><circle cx={spec.time === "day" ? 600 : spec.time === "dawn" ? 160 : 650} cy={spec.time === "day" ? 85 : 232} r="120" fill={`url(#sun${uid})`} opacity={storm ? 0.2 : 0.8} /><circle cx={spec.time === "day" ? 600 : spec.time === "dawn" ? 160 : 650} cy={spec.time === "day" ? 85 : 232} r="30" fill="#fff4c4" opacity={storm ? 0.3 : 0.95} /></g>}
      {clouds.map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity={storm ? 0.9 : 0.7}><ellipse cx="0" cy="0" rx="60" ry="16" fill={storm ? "#4a4f60" : "#fff"} /><ellipse cx="-26" cy="-10" rx="30" ry="14" fill={storm ? "#565c70" : "#fff"} /><ellipse cx="22" cy="-12" rx="34" ry="15" fill={storm ? "#565c70" : "#fff"} /></g>)}
      <g filter={light ? undefined : `url(#rough${uid})`}>
        <path d={ridge(seed + 1, HORIZON - 40, 70, 70)} fill={bio.far} />
        <path d={ridge(seed + 2, HORIZON - 12, 38, 54)} fill={bio.mid} />
        {spec.biome === "sea" ? <rect x="-20" y={HORIZON - 4} width={W + 40} height={H} fill="#5f8fb4" /> : null}
        {spec.biome === "sea" ? <path d={`M-20 ${HORIZON + 78} Q200 ${HORIZON + 60} 420 ${HORIZON + 82} T820 ${HORIZON + 78} L820 ${H} L-20 ${H}Z`} fill={bio.ground} /> : <rect x="-20" y={HORIZON} width={W + 40} height={H - HORIZON + 20} fill={bio.ground} />}
        {spec.biome === "river" && <path d={`M300 ${H} Q380 ${HORIZON + 80} 420 ${HORIZON} L450 ${HORIZON} Q430 ${HORIZON + 90} 560 ${H}Z`} fill="#6fa6cf" />}
        <path d={`M-20 ${H - 36} Q200 ${H - 70} 420 ${H - 40} T820 ${H - 50} L820 ${H} L-20 ${H}Z`} fill={bio.near} />
        {spec.biome === "inside" && <rect x="-20" y="-20" width={W + 40} height={HORIZON + 10} fill="#7a5c3d" opacity=".92" />}
      </g>
      {spec.light && <g><path d="M300 -10 L500 -10 L560 330 L240 330Z" fill={`url(#ray${uid})`} /><circle cx="400" cy="-6" r="40" fill="#fff6c8" opacity=".7" /></g>}
      {items.map((i) => i.node)}
      {fog && <rect width={W} height={H} fill="#e8eef2" opacity=".45" />}
      {spec.weather === "rain" || storm ? <g stroke="#cfe0ee" strokeWidth="1.2" opacity=".55">{rain.map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 16} />)}</g> : null}
      {dim < 1 && <rect width={W} height={H} fill="#0b1020" opacity={1 - dim} style={{ mixBlendMode: "multiply" }} />}
      {!light && <rect width={W} height={H} filter={`url(#grain${uid})`} opacity=".16" style={{ mixBlendMode: "multiply" }} />}
      <rect width={W} height={H} fill={`url(#vig${uid})`} />
      <rect x="6" y="6" width={W - 12} height={H - 12} fill="none" stroke="#f4e9cc" strokeWidth="2.5" opacity=".7" />
    </svg>
  );
}
