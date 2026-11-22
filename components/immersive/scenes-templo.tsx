"use client";

// Solomon's temple (docs/ambientes/templo-de-salomao.md): the courts and the building seen from outside (hewn stone, the two bronze pillars, the Sea on twelve
// oxen, ten lavers on carts, the bronze altar, the three-story side rooms) and the inside (cedar carved with gourds and flowers overlaid with gold, ten lampstands,
// ten tables, the altar of incense, the Most Holy Place with two cherubim of ten cubits). Measures: lib/immersive/templo.ts. What the text does not say (courts,
// stone color, platform, faces of the cherubim, the oxen's pose) is reconstruction. God's presence is only light (RA-20); the cherubim have no faces.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group, type Texture } from "three";
import { Flame, Instances, paintHammered, paintPitch, paintWood, Smoke, useTexture } from "./proc";

import { ALTAR, CHAMBERS, CHERUB, INNER_COURT, LAVER_X, LAVER_Z, OUTER, OUTER_COURT, PILLARS, SEA, TEMPLE as T, Z } from "@/lib/immersive/templo";

type Detail = 0 | 1 | 2;
type Item = [number, number, number, number?, number?];
const GOLD = "#e3b53b", BRONZE = "#b5703c", STONE = "#d8cdb2", CEDAR = "#8a5a36", BLUE = "#33408f", PURPLE = "#7d2a5c", CRIMSON = "#b3202f";
const rand = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const Mat = ({ c, r = 0.85, m = 0, map, e, ei = 1.2, side }: { c: string; r?: number; m?: number; map?: Texture; e?: string; ei?: number; side?: typeof DoubleSide }) => <meshStandardMaterial color={c} roughness={r} metalness={m} map={map} emissive={e} emissiveIntensity={e ? ei : 0} side={side} />;
const gold = (map?: Texture, e = true) => <Mat c="#ffffff" map={map} m={0.7} r={0.28} e={e ? "#7a5a10" : undefined} ei={0.5} />;

/** Hewn limestone laid in courses (1 Rs 6:7: stone prepared at the quarry, no hammer heard). */
const paintAshlar = (base: string) => (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  const rows = 6, rh = h / rows;
  for (let i = 0; i < rows; i++) {
    const bw = w / (i % 2 ? 3 : 2.5), off = (i % 2) * bw * 0.5;
    for (let x = -off; x < w; x += bw) { const k = 0.9 + r() * 0.16; ctx.fillStyle = `rgba(${Math.round(120 * k)},${Math.round(108 * k)},${Math.round(84 * k)},0.18)`; ctx.fillRect(x + 1, i * rh + 1, bw - 2, rh - 2); ctx.strokeStyle = "rgba(70,58,40,0.55)"; ctx.lineWidth = 1.5; ctx.strokeRect(x, i * rh, bw, rh); }
  }
  for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.07})`; ctx.fillRect(r() * w, r() * h, 2, 1); }
};
/** Cedar paneling carved with gourds and open flowers, overlaid with gold (1 Rs 6:18, 6:29-30). */
const paintCarved = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => {
  ctx.fillStyle = "#7a4f2e"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { ctx.strokeStyle = `rgba(40,20,5,${0.08 + r() * 0.1})`; ctx.beginPath(); ctx.moveTo(r() * w, 0); ctx.lineTo(r() * w, h); ctx.stroke(); }
  const n = 4, s = w / n;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const cx = (col + 0.5) * s, cy = (row + 0.5) * s;
    if ((row + col) % 2) { ctx.fillStyle = "#e3b53b"; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.17, s * 0.27, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#8a6414"; ctx.lineWidth = 2; ctx.stroke(); } // gourd
    else { ctx.fillStyle = "#e3b53b"; for (let k = 0; k < 8; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate((k * Math.PI) / 4); ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.07, s * 0.16, 0, 0, 7); ctx.fill(); ctx.restore(); } ctx.fillStyle = "#8a6414"; ctx.beginPath(); ctx.arc(cx, cy, s * 0.07, 0, 7); ctx.fill(); } // open flower
  }
  ctx.strokeStyle = "rgba(255,230,150,0.25)"; for (let i = 0; i < h; i += 4) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
};
const paintGrass = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => { ctx.fillStyle = "#b8a77a"; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(${90 + r() * 50},${100 + r() * 40},${60 + r() * 30},0.25)`; ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2); } };

function Curtain({ x, y, z, w, h }: { x: number; y: number; z: number; w: number; h: number }) {
  const tex = useTexture((ctx, tw, th) => { const cols = [BLUE, PURPLE, CRIMSON]; for (let i = 0; i < 9; i++) { ctx.fillStyle = cols[i % 3]; ctx.fillRect((i * tw) / 9, 0, tw / 9 + 1, th); } }, 128, 128, [1, 1], 3);
  return <mesh position={[x, y, z]}><planeGeometry args={[w, h]} /><Mat c="#ffffff" map={tex} side={DoubleSide} /></mesh>;
}

/** A low wall of three rows of hewn stone and a row of cedar beams (1 Rs 6:36). */
function CourtWall({ x0, x1, z0, z1, gate, h, seg }: { x0: number; x1: number; z0: number; z1: number; gate: number; h: number; seg: Texture }) {
  const row = h * 0.78, beam = h * 0.22, t = 0.8;
  const parts: { cx: number; cz: number; sx: number; sz: number }[] = [
    { cx: x0 - t / 2, cz: (z0 + z1) / 2, sx: t, sz: z1 - z0 + t * 2 }, { cx: x1 + t / 2, cz: (z0 + z1) / 2, sx: t, sz: z1 - z0 + t * 2 },
    { cx: (x0 + x1) / 2, cz: z0 - t / 2, sx: x1 - x0 + t * 2, sz: t },
    { cx: (x0 - gate) / 2, cz: z1 + t / 2, sx: -gate - x0 + t, sz: t }, { cx: (x1 + gate) / 2, cz: z1 + t / 2, sx: x1 - gate + t, sz: t },
  ];
  return <>{parts.map((p, i) => <group key={i} position={[p.cx, 0, p.cz]}><mesh position={[0, row / 2, 0]}><boxGeometry args={[p.sx, row, p.sz]} /><Mat c="#ffffff" map={seg} /></mesh><mesh position={[0, row + beam / 2, 0]}><boxGeometry args={[p.sx + 0.1, beam, p.sz + 0.1]} /><Mat c={CEDAR} /></mesh></group>)}</>;
}

export function TempleCourts({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 20 : detail === 1 ? 12 : 8;
  const stone = useTexture(paintAshlar(STONE), 256, 256, [6, 2], 3);
  const wallStone = useTexture(paintAshlar("#cfc3a6"), 256, 256, [14, 1], 5);
  const bigStone = useTexture(paintAshlar("#d4c9ad"), 256, 256, [10, 4], 4);
  const paving = useTexture(paintGrass, 256, 256, [120, 120], 8);
  const bronze = useTexture(paintHammered("#d9a064"), 128, 128, [2, 2], 6);
  const wood = useTexture(paintWood("#7a4f2e", 40, 0.5), 128, 128, [1, 3], 2);
  const pitch = useTexture(paintPitch, 128, 128, [1, 1], 1);
  const doorTex = useTexture(paintCarved, 128, 128, [1, 2], 2);
  const o = OUTER, hT = T.height;
  const hills = useMemo<Item[]>(() => Array.from({ length: 16 }, (_, i) => [Math.cos(i * 0.4) * 190, 8, Math.sin(i * 0.4) * 190 - 20, 0, 24 + (i % 4) * 9] as Item), []);
  const olives = useMemo(() => { const r = rand(17), tr: Item[] = [], cr: Item[] = []; for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 75 + r() * 90, x = Math.cos(a) * d, z = Math.sin(a) * d - 20; if (Math.abs(x) < 64 && z > OUTER_COURT.z0 - 6 && z < OUTER_COURT.z1 + 6) continue; const s = 0.8 + r() * 0.7; tr.push([x, 1.2 * s, z, 0, s]); cr.push([x, 3 * s, z, r() * 3, s]); } return { tr, cr }; }, []);
  const rimOxen = useMemo(() => Array.from({ length: 12 }, (_, i) => { const group = Math.floor(i / 3), k = i % 3, a = (group * Math.PI) / 2 + (k - 1) * 0.42; return { a, x: Math.cos(a) * (SEA.r - 0.55), z: Math.sin(a) * (SEA.r - 0.55) }; }), []);
  const pomegranates = useMemo<Item[]>(() => Array.from({ length: 36 }, (_, i) => [Math.cos((i / 18) * 6.28) * 1.05, i < 18 ? 0.35 : 0.8, Math.sin((i / 18) * 6.28) * 1.05, 0, 1] as Item), []);
  const stakes = useMemo<Item[]>(() => [-1, 1].flatMap((s) => [0, 1].map((k) => [s * PILLARS.x, PILLARS.height + 0.2 + k * 0.25, PILLARS.z, 0, 1] as Item)), []);
  const side = (s: number) => CHAMBERS.map((w, k) => <mesh key={`${s}${k}`} position={[s * (o + w / 2), 1.15 + k * 2.25, Z.end / 2 - 3]}><boxGeometry args={[w, 2.2, -Z.end - 6.2]} /><Mat c="#ffffff" map={stone} /></mesh>);

  return (
    <group>
      <hemisphereLight args={["#f2f0e6", "#9b8c64", 0.95]} />
      <directionalLight position={[-50, 70, 60]} intensity={2.0} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[600, 600]} /><Mat c="#ffffff" map={paving} r={1} /></mesh>
      <mesh position={[0, 0.03, (OUTER_COURT.z1 + OUTER_COURT.z0) / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[OUTER_COURT.halfW * 2, OUTER_COURT.z1 - OUTER_COURT.z0]} /><Mat c="#ffffff" map={bigStone} r={0.9} /></mesh>
      <Instances items={hills}><sphereGeometry args={[1, 10, 6]} /><Mat c="#a89468" r={1} /></Instances>
      <Instances items={olives.tr}><cylinderGeometry args={[0.2, 0.3, 2.4, 6]} /><Mat c="#6a5a42" /></Instances>
      <Instances items={olives.cr}><sphereGeometry args={[1.6, 7, 5]} /><Mat c="#7f8a56" /></Instances>
      <CourtWall x0={-OUTER_COURT.halfW} x1={OUTER_COURT.halfW} z0={OUTER_COURT.z0} z1={OUTER_COURT.z1} gate={OUTER_COURT.gate} h={4.2} seg={wallStone} />
      <CourtWall x0={-INNER_COURT.halfW} x1={INNER_COURT.halfW} z0={INNER_COURT.z0} z1={INNER_COURT.z1} gate={INNER_COURT.gate} h={3.4} seg={wallStone} />
      {/* gates of the courts (reconstruction): a lintel of cedar over the opening, bronze doors drawn back */}
      {[[OUTER_COURT.z1, OUTER_COURT.gate, 6.4], [INNER_COURT.z1, INNER_COURT.gate, 5]].map(([z, g, h]) => <group key={z}>{[-1, 1].map((s) => <mesh key={s} position={[s * (g + 0.5), h / 2, z + 0.4]}><boxGeometry args={[1, h, 1.2]} /><Mat c="#ffffff" map={stone} /></mesh>)}<mesh position={[0, h + 0.2, z + 0.4]}><boxGeometry args={[g * 2 + 2, 0.5, 1.4]} /><Mat c={CEDAR} map={wood} /></mesh></group>)}

      {/* the house: hewn stone, a flat roof of cedar beams, narrow windows with frames (1 Rs 6:4, 6:9-10) */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * (T.halfIn + T.wall / 2), hT / 2, Z.end / 2]}><boxGeometry args={[T.wall, hT, -Z.end]} /><Mat c="#ffffff" map={stone} /></mesh>)}
      <mesh position={[0, hT / 2, Z.end + T.wall / 2]}><boxGeometry args={[o * 2, hT, T.wall]} /><Mat c="#ffffff" map={stone} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (1.7 + o) / 2, hT / 2, Z.doorWall[0] + T.wall / 2]}><boxGeometry args={[o - 1.7, hT, T.wall]} /><Mat c="#ffffff" map={stone} /></mesh>)}
      <mesh position={[0, hT * 0.86, Z.doorWall[0] + T.wall / 2]}><boxGeometry args={[3.4, hT * 0.28, T.wall]} /><Mat c="#ffffff" map={stone} /></mesh>
      <mesh position={[0, hT + 0.3, Z.end / 2]}><boxGeometry args={[o * 2 + 0.8, 0.6, -Z.end + 0.6]} /><Mat c={CEDAR} map={wood} /></mesh>
      {[-1, 1].flatMap((s) => [-10, -16, -22, -29].map((z) => <mesh key={`${s}${z}`} position={[s * (o + 0.02), hT * 0.72, z]}><boxGeometry args={[0.1, 1.6, 0.55]} /><Mat c="#1b140c" e="#ffd27a" ei={0.7} /></mesh>))}
      {side(-1)}{side(1)}
      {/* porch: open to the east, two walls and a ceiling (the 120 cubits of 2 Cr 3:4 are a disputed reading: here, the height of the house) */}
      <mesh position={[0, hT + 0.05, -T.porchD / 2]}><boxGeometry args={[T.halfIn * 2, 0.5, T.porchD]} /><Mat c={CEDAR} map={wood} /></mesh>
      <mesh position={[0, 0.02, -T.porchD / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[T.halfIn * 2, T.porchD]} /><Mat c="#ffffff" map={stone} r={0.7} side={DoubleSide} /></mesh>
      {/* the doors of the house: olive wood with carved cherubim, palm trees and open flowers, overlaid with gold, drawn open (1 Rs 6:31-35) */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * 1.55, 3.4, Z.doorWall[0] + 0.15]} rotation={[0, s * 0.9, 0]}><boxGeometry args={[0.9, 6.4, 0.12]} /><Mat c="#ffffff" map={doorTex} m={0.5} r={0.35} /></mesh>)}

      {/* Jachin (right/south) and Boaz (left/north): two bronze pillars, 18 cubits high, 12 around, capitals of 5 cubits with lilies, pomegranates and chain work (1 Rs 7:15-22) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * PILLARS.x, 0, PILLARS.z]}>
          <mesh position={[0, PILLARS.height / 2, 0]}><cylinderGeometry args={[PILLARS.r * 0.86, PILLARS.r, PILLARS.height, seg]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
          <mesh position={[0, PILLARS.height + PILLARS.capital * 0.3, 0]}><cylinderGeometry args={[1.25, PILLARS.r * 0.86, PILLARS.capital * 0.6, seg]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
          <mesh position={[0, PILLARS.height + PILLARS.capital * 0.72, 0]}><sphereGeometry args={[1.15, seg, 6, 0, 6.28, 0, 1.2]} /><Mat c={BRONZE} m={0.6} r={0.4} /></mesh>
          <mesh position={[0, PILLARS.height - 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[PILLARS.r * 0.95, 0.07, 5, seg]} /><Mat c={BRONZE} m={0.6} r={0.4} /></mesh>
        </group>
      ))}
      <group position={[PILLARS.x, 0, PILLARS.z]}><Instances items={pomegranates.map(([x, y, z]) => [x, PILLARS.height + 0.6 + y, z] as Item)}><sphereGeometry args={[0.12, 6, 5]} /><Mat c={BRONZE} m={0.6} r={0.4} /></Instances></group>
      <group position={[-PILLARS.x, 0, PILLARS.z]}><Instances items={pomegranates.map(([x, y, z]) => [x, PILLARS.height + 0.6 + y, z] as Item)}><sphereGeometry args={[0.12, 6, 5]} /><Mat c={BRONZE} m={0.6} r={0.4} /></Instances></group>
      <Instances items={stakes}><torusGeometry args={[1.1, 0.04, 4, 14]} /><Mat c={BRONZE} m={0.6} r={0.4} /></Instances>

      {/* the bronze altar: 20 x 20 x 10 cubits (2 Cr 4:1), horns, a ramp on the south side (reconstruction), fire and smoke */}
      <group position={[ALTAR.at[0], 0, ALTAR.at[1]]}>
        <mesh position={[0, ALTAR.height / 2, 0]}><boxGeometry args={[ALTAR.side, ALTAR.height, ALTAR.side]} /><Mat c="#ffffff" map={bronze} m={0.5} r={0.5} /></mesh>
        <mesh position={[0, ALTAR.height * 0.55, 0]}><boxGeometry args={[ALTAR.side + 0.3, 0.25, ALTAR.side + 0.3]} /><Mat c={BRONZE} m={0.5} r={0.45} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (ALTAR.side / 2 - 0.25), ALTAR.height + 0.4, sz * (ALTAR.side / 2 - 0.25)]}><coneGeometry args={[0.3, 0.9, seg]} /><Mat c={BRONZE} m={0.5} r={0.45} /></mesh>)}
        <mesh position={[0, 1.15, ALTAR.side / 2 + 3.1]} rotation={[0.355, 0, 0]}><boxGeometry args={[3, 0.25, 6.6]} /><Mat c="#ffffff" map={stone} /></mesh>
        <mesh position={[0, ALTAR.height + 0.4, 0]}><boxGeometry args={[ALTAR.side - 1.2, 0.5, ALTAR.side - 1.2]} /><Mat c="#2a1d14" /></mesh>
        <Flame size={1.5} intensity={detail < 2 ? 9 : 0} position={[0, ALTAR.height + 1.2, 0]} /><Flame size={1.1} intensity={0} position={[-2.2, ALTAR.height + 1, 1.2]} /><Flame size={1.1} intensity={0} position={[2.4, ALTAR.height + 1, -1]} />
        {detail < 2 && <Smoke count={18} height={14} spread={1.2} color="#6b655c" radius={0.8} position={[0, ALTAR.height + 2, 0]} />}
      </group>

      {/* the molten Sea: 10 cubits across, 5 high, a rim like a lily, on twelve oxen in four groups of three, facing the four directions (1 Rs 7:23-26) */}
      <group position={[SEA.at[0], 0, SEA.at[1]]}>
        <mesh position={[0, SEA.height * 0.5 + 0.6, 0]}><cylinderGeometry args={[SEA.r, SEA.r * 0.85, SEA.height, seg + 8]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
        <mesh position={[0, SEA.height + 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[SEA.r, 0.14, 6, seg + 10]} /><Mat c={BRONZE} m={0.6} r={0.4} /></mesh>
        <mesh position={[0, SEA.height + 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[SEA.r - 0.08, seg + 8]} /><meshStandardMaterial color="#6fb0d0" roughness={0.05} metalness={0.3} /></mesh>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[SEA.r * 0.8, SEA.r * 0.9, 0.6, seg + 8]} /><Mat c="#ffffff" map={stone} /></mesh>
        {rimOxen.map((o2, i) => <group key={i} position={[o2.x, 0.6, o2.z]} rotation={[0, -o2.a, 0]}>
          <mesh position={[0.1, 0.55, 0]}><boxGeometry args={[1.5, 0.85, 0.62]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
          <mesh position={[1.0, 0.8, 0]}><boxGeometry args={[0.5, 0.45, 0.42]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
          {[[-0.55, -0.22], [-0.55, 0.22], [0.65, -0.22], [0.65, 0.22]].map(([lx, lz]) => <mesh key={`${lx}${lz}`} position={[lx, -0.05, lz]}><boxGeometry args={[0.16, 0.6, 0.16]} /><Mat c={BRONZE} m={0.6} r={0.4} /></mesh>)}
        </group>)}
      </group>

      {/* the ten lavers on bronze carts, five on each side, with wheels like chariot wheels, 40 baths each (1 Rs 7:27-39) */}
      {[-1, 1].flatMap((s) => LAVER_Z.map((z) => (
        <group key={`${s}${z}`} position={[s * LAVER_X, 0, z]}>
          <mesh position={[0, 0.85, 0]}><boxGeometry args={[1.8, 0.9, 1.8]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
          {[[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].map(([wx, wz]) => <mesh key={`${wx}${wz}`} position={[wx, 0.38, wz]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.36, 0.08, 5, 10]} /><Mat c={BRONZE} m={0.6} r={0.4} /></mesh>)}
          <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[0.85, 0.55, 0.65, seg]} /><Mat c="#ffffff" map={bronze} m={0.6} r={0.4} /></mesh>
          <mesh position={[0, 1.87, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.8, seg]} /><meshStandardMaterial color="#6fb0d0" roughness={0.05} metalness={0.3} /></mesh>
        </group>
      )))}
      <mesh position={[ALTAR.at[0], 0.04, ALTAR.at[1] + 10]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 30]} /><Mat c="#ffffff" map={pitch} r={1} /></mesh>
    </group>
  );
}

function Cherub({ x }: { x: number }) {
  const g = useTexture(paintHammered("#e3b53b"), 128, 128, [1, 2], 7);
  const h = CHERUB.height, w = CHERUB.wing;
  // an abstract cherub (no face): a column of olive wood overlaid with gold, a hint of a head, and two layered wings of five cubits each (1 Rs 6:23-27)
  return (
    <group position={[x, 0, Z.debirFront - T.debirL / 2 + 1.5]}>
      <mesh position={[0, h * 0.4, 0]}><boxGeometry args={[0.8, h * 0.8, 0.8]} />{gold(g)}</mesh>
      <mesh position={[0, h * 0.86, 0]}><sphereGeometry args={[0.42, 10, 8]} />{gold(g)}</mesh>
      {[-1, 1].map((s) => [0, 1, 2].map((k) => <mesh key={`${s}${k}`} position={[s * (w / 2 + 0.2), h * 0.62 + k * 0.28, 0]} rotation={[0, 0, s * (0.12 - k * 0.05)]}><boxGeometry args={[w - k * 0.25, 0.14, 0.9 - k * 0.2]} />{gold(g)}</mesh>))}
    </group>
  );
}

export function TempleInterior({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 12 : 8;
  const hi = T.halfIn, h = T.height, cz = (Z.holyFront + Z.holyBack) / 2, hl = T.holyL;
  const carved = useTexture(paintCarved, 256, 256, [6, 2], 2);
  const carvedBack = useTexture(paintCarved, 256, 256, [5, 2], 4);
  const goldTex = useTexture(paintHammered("#e3b53b"), 128, 128, [3, 3], 7);
  const floor = useTexture(paintWood("#9a7a46", 40, 0.35), 128, 128, [3, 10], 12);
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.children.forEach((c, i) => { c.scale.y = 0.9 + Math.sin(clock.elapsedTime * 3 + i) * 0.08; }); });
  const dz = (Z.debirFront + Z.debirBack) / 2, dh = T.debirL;
  const lamps = useMemo(() => [-1, 1].flatMap((s) => [0, 1, 2, 3, 4].map((k) => [s * (hi - 0.7), Z.holyFront - 2.6 - k * 3.4] as [number, number])), [hi]);
  const tables = useMemo(() => [-1, 1].flatMap((s) => [0, 1, 2, 3, 4].map((k) => [s * (hi - 1.9), Z.holyFront - 1.2 - k * 3.4 - 0.9] as [number, number])), [hi]);
  return (
    <group>
      <ambientLight intensity={0.55} color="#ffe7b8" />
      <pointLight position={[0, h * 0.7, cz + 5]} intensity={5} distance={26} color="#ffdc94" />
      <pointLight position={[0, h * 0.7, cz - 6]} intensity={4} distance={22} color="#ffd88a" />
      <pointLight position={[0, 5, dz]} intensity={7} distance={16} color="#fff0c0" />
      {/* floor: cypress overlaid with gold (1 Rs 6:15, 6:30) */}
      <mesh position={[0, 0.09, (Z.doorWall[0] + Z.debirBack) / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[hi * 2, Z.doorWall[0] - Z.debirBack]} /><Mat c="#ffffff" map={floor} m={0.4} r={0.45} e="#4a3510" ei={0.4} /></mesh>
      {/* walls of the Holy Place: cedar carved with gourds and open flowers; no stone is seen (1 Rs 6:18) */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * (hi - 0.04), h / 2, cz]} rotation={[0, s * -Math.PI / 2, 0]}><planeGeometry args={[hl + T.partition, h]} /><Mat c="#ffffff" map={carved} m={0.5} r={0.4} e="#4a3510" ei={0.35} side={DoubleSide} /></mesh>)}
      <mesh position={[0, h / 2, Z.holyFront - 0.04]}><planeGeometry args={[hi * 2, h]} /><Mat c="#ffffff" map={carvedBack} m={0.5} r={0.4} e="#4a3510" ei={0.3} side={DoubleSide} /></mesh>
      {/* ceiling: beams and boards of cedar (1 Rs 6:9) */}
      <mesh position={[0, h - 0.05, (Z.holyFront + Z.debirBack) / 2]}><boxGeometry args={[hi * 2, 0.3, Z.holyFront - Z.debirBack]} /><Mat c="#6a4326" /></mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0, h - 0.4, Z.holyFront - 1 - i * 2.1]}><boxGeometry args={[hi * 2, 0.4, 0.35]} /><Mat c="#8a5a36" /></mesh>)}

      {/* partition of the Most Holy Place: olive-wood doors with carved cherubim, palms and flowers, overlaid with gold, held open by chains of gold (1 Rs 6:21, 6:31-32) */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * (2.2 + (hi - 2.2) / 2), h / 2, Z.debirFront + 0.45]}><boxGeometry args={[hi - 2.2, h, T.partition]} />{gold(goldTex)}</mesh>)}
      <mesh position={[0, 7.2 + (h - 7.2) / 2, Z.debirFront + 0.45]}><boxGeometry args={[4.4, h - 7.2, T.partition]} />{gold(goldTex)}</mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 2.0, 3.5, Z.holyBack - 0.45]} rotation={[0, s * 1.1, 0]}><boxGeometry args={[1.0, 6.9, 0.1]} /><Mat c="#ffffff" map={carvedBack} m={0.6} r={0.35} e="#7a5a10" ei={0.5} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={`c${s}`} position={[s * 1.4, 6.6, Z.holyBack - 0.1]} rotation={[0, 0, s * 0.5]}><cylinderGeometry args={[0.03, 0.03, 1.6, 4]} /><Mat c={GOLD} m={0.8} r={0.25} /></mesh>)}
      {[-1, 1].map((s) => <Curtain key={`v${s}`} x={s * 1.55} y={3.6} z={Z.holyBack + 0.12} w={1.2} h={7.2} />)}

      {/* the Most Holy Place: a cube of 20 cubits, walls and floor overlaid with gold; seen from the door, never entered (1 Rs 6:20-22; Lv 16:2) */}
      <mesh position={[0, dh / 2, Z.debirBack + 0.05]}><boxGeometry args={[hi * 2, dh, 0.1]} />{gold(goldTex)}</mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (hi - 0.05), dh / 2, dz]}><boxGeometry args={[0.1, dh, T.debirL]} />{gold(goldTex)}</mesh>)}
      <mesh position={[0, dh, dz]}><boxGeometry args={[hi * 2, 0.1, T.debirL]} />{gold(goldTex)}</mesh>
      <mesh position={[0, 0.06, dz]}><boxGeometry args={[hi * 2, 0.1, T.debirL]} />{gold(goldTex)}</mesh>
      <Cherub x={-hi / 2} /><Cherub x={hi / 2} />
      {/* the ark of the covenant between the cherubim (1 Rs 8:6-9), the presence only as light */}
      <group position={[0, 0, dz + 1.5]}>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.1, 0.7, 1.9]} />{gold(goldTex)}</mesh>
        <mesh position={[0, 0.9, 0]}><boxGeometry args={[1.15, 0.08, 1.95]} />{gold(goldTex)}</mesh>
        <mesh position={[0, 3.2, 0]}><sphereGeometry args={[1.4, 12, 8]} /><meshBasicMaterial color="#fff4cc" transparent opacity={0.18} /></mesh>
        <pointLight position={[0, 3.2, 0]} intensity={6} distance={14} color="#fff0c0" />
      </group>

      {/* ten lampstands of pure gold, five on the right and five on the left, before the Oracle (1 Rs 7:49) */}
      <group ref={g}>
        {lamps.map(([x, z], i) => <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.25, 0.32, 0.1, seg]} />{gold(goldTex, false)}</mesh>
          <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.035, 0.05, 1.5, 6]} />{gold(goldTex, false)}</mesh>
          {[-0.45, 0, 0.45].map((lx) => <mesh key={lx} position={[lx, 1.35 - Math.abs(lx) * 0.4, 0]}><cylinderGeometry args={[0.05, 0.03, 0.12, 6]} />{gold(goldTex, false)}</mesh>)}
          <mesh position={[0, 1.2, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.45, 0.018, 4, 10, Math.PI]} />{gold(goldTex, false)}</mesh>
          {[-0.45, 0, 0.45].map((lx) => <mesh key={`f${lx}`} position={[lx, 1.52 - Math.abs(lx) * 0.4, 0]}><coneGeometry args={[0.04, 0.12, 5]} /><meshStandardMaterial color="#ffd36a" emissive="#ff9a2c" emissiveIntensity={2.2} /></mesh>)}
        </group>)}
      </group>
      {/* ten tables of gold, five on each side (2 Cr 4:8), and the table of the bread of the Presence (1 Rs 7:48) */}
      {tables.map(([x, z], i) => <group key={i} position={[x, 0, z]}><mesh position={[0, 0.9, 0]}><boxGeometry args={[0.9, 0.08, 1.6]} />{gold(goldTex, false)}</mesh>{[[-0.4, -0.7], [0.4, -0.7], [-0.4, 0.7], [0.4, 0.7]].map(([lx, lz]) => <mesh key={`${lx}${lz}`} position={[lx, 0.45, lz]}><boxGeometry args={[0.07, 0.9, 0.07]} />{gold(goldTex, false)}</mesh>)}</group>)}
      <group position={[0, 0, Z.holyBack + 7]}><mesh position={[0, 0.5, 0]}><boxGeometry args={[1.2, 0.07, 2.2]} />{gold(goldTex, false)}</mesh>{[-0.5, 0.5].map((lx) => [0, 1, 2].map((k) => <mesh key={`${lx}${k}`} position={[lx * 0.4, 0.62 + k * 0.1, 0]}><boxGeometry args={[0.3, 0.09, 1.7]} /><Mat c="#c99a52" /></mesh>))}</group>
      {/* the altar of incense, of cedar overlaid with gold, before the Oracle (1 Rs 6:20-22) */}
      <group position={[0, 0, Z.holyBack + 3.0]}>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[1.0, 1.1, 1.0]} />{gold(goldTex)}</mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * 0.45, 1.2, sz * 0.45]}><coneGeometry args={[0.07, 0.2, 5]} />{gold(goldTex, false)}</mesh>)}
        <Smoke count={14} height={5} spread={0.4} color="#ece4d2" radius={0.2} position={[0, 1.3, 0]} />
      </group>
      {/* light shafts through the narrow windows */}
      {[-1, 1].flatMap((s) => [-10, -16, -22].map((z) => <mesh key={`${s}${z}`} position={[s * (hi - 1.6), h * 0.55, z]} rotation={[0, 0, s * 0.5]}><boxGeometry args={[0.5, h * 0.55, 0.9]} /><meshBasicMaterial color="#fff2cf" transparent opacity={0.07} depthWrite={false} /></mesh>))}
    </group>
  );
}

export const TEMPLE_SCENES: Record<string, (p: { detail: Detail }) => React.JSX.Element> = { temple_courts: TempleCourts, temple_inside: TempleInterior };

