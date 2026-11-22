"use client";

// The New Jerusalem (docs/ambientes/nova-jerusalem.md), Apocalipse 21-22: the wall of jasper on twelve foundations of precious stones, twelve gates each of a single pearl with
// an angel, a street of pure gold like transparent glass, the river of the water of life from the throne, the tree of life with twelve fruits, no temple, no sun: the glory of
// God is its light. The size is SYMBOLIC (see lib/immersive/jerusalem.ts). The throne is only light, never a figure (RA-20). Everything is drawn in code.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group, type Texture } from "three";
import { Instances, paintHammered, useTexture } from "./proc";
import { CITY, RIVER, STONES, THRONE, TREES_Z } from "@/lib/immersive/jerusalem";

type Detail = 0 | 1 | 2;
type Item = [number, number, number, number?, number?];
const rand = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const Mat = ({ c, r = 0.6, m = 0, map, e, ei = 1, side, o }: { c: string; r?: number; m?: number; map?: Texture; e?: string; ei?: number; side?: typeof DoubleSide; o?: number }) => <meshStandardMaterial color={c} roughness={r} metalness={m} map={map} emissive={e} emissiveIntensity={e ? ei : 0} side={side} transparent={o !== undefined} opacity={o ?? 1} />;

/** The wall: twelve horizontal bands of precious stones at the base (the foundations, Ap 21:19-20) under a wall of jasper (Ap 21:18). */
const paintWall = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => {
  const base = h * 0.3; // the top (jasper) occupies the upper 30%
  const jasper = ctx.createLinearGradient(0, 0, 0, base); jasper.addColorStop(0, "#a8d8a0"); jasper.addColorStop(1, "#7fbf86"); ctx.fillStyle = jasper; ctx.fillRect(0, 0, w, base);
  const bh = (h - base) / STONES.length;
  STONES.forEach((s, i) => {
    ctx.fillStyle = s.color; ctx.fillRect(0, base + i * bh, w, bh);
    for (let k = 0; k < 80; k++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.18})`; ctx.fillRect(r() * w, base + i * bh + r() * bh, 4 + r() * 20, 1 + r() * 2); }
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, base + i * bh, w, 2);
  });
  for (let k = 0; k < 160; k++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.2})`; ctx.fillRect(r() * w, r() * base, 3 + r() * 30, 1); }
};
const paintGoldStreet = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#f6d467"); g.addColorStop(0.5, "#ffe9a0"); g.addColorStop(1, "#eec04c"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(160,110,20,0.35)"; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke(); }
  for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.2})`; ctx.fillRect(r() * w, r() * h, 6 + r() * 20, 2); }
};
const paintWater = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => {
  ctx.fillStyle = "#9fdcf2"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`; ctx.lineWidth = 1 + r() * 2; const y = r() * h, x = r() * w; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 20, y - 6, x + 40, y + 6, x + 70, y); ctx.stroke(); }
};
const paintGrass = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => { ctx.fillStyle = "#a9cf8a"; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { ctx.fillStyle = `rgba(${90 + r() * 60},${150 + r() * 60},${70 + r() * 40},0.3)`; ctx.fillRect(r() * w, r() * h, 2, 3 + r() * 3); } for (let i = 0; i < 60; i++) { ctx.fillStyle = ["#fff", "#f6d36a", "#f3a0c0"][i % 3]; ctx.fillRect(r() * w, r() * h, 3, 3); } };

function Angel({ x, z, ry }: { x: number; z: number; ry: number }) {
  // a stylized angel at the gate (Ap 21:12): a glowing robe, a head without a face, two wings
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 1.7, 0]}><cylinderGeometry args={[0.35, 0.7, 3.4, 10]} /><Mat c="#fffaf0" e="#fff1c0" ei={0.35} r={0.8} /></mesh>
      <mesh position={[0, 3.6, 0]}><sphereGeometry args={[0.3, 10, 8]} /><Mat c="#f4dcc0" e="#fff1c0" ei={0.2} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.9, 2.7, -0.3]} rotation={[0, s * 0.5, s * 0.5]}><boxGeometry args={[0.1, 2.4, 1.2]} /><Mat c="#ffffff" e="#fff6d8" ei={0.4} /></mesh>)}
    </group>
  );
}

/** A gate of a single pearl (Ap 21:21): two pillars and an arch, pearly white with a soft shine. */
function Gate({ x, z, side, seg, tribe }: { x: number; z: number; side: number; seg: number; tribe: string }) {
  const w = CITY.gateW, h = CITY.gateH, t = CITY.wall + 0.6;
  const vertical = side % 2 === 1; // east/west walls: the gate faces along x
  const rot = vertical ? Math.PI / 2 : 0;
  void tribe;
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (w / 2 + 0.9), h / 2, 0]}><boxGeometry args={[1.8, h, t]} /><Mat c="#f7f0f4" r={0.25} m={0.15} e="#ffeefa" ei={0.35} /></mesh>)}
      <mesh position={[0, h, 0]} rotation={[0, 0, 0]}><torusGeometry args={[w / 2 + 0.9, 0.9, 8, seg + 12, Math.PI]} /><Mat c="#f7f0f4" r={0.25} m={0.15} e="#ffeefa" ei={0.35} /></mesh>
      <mesh position={[0, h + w / 2 + 1.2, 0]}><sphereGeometry args={[1.0, 10, 8]} /><Mat c="#fff6e0" e="#ffe9a0" ei={0.9} /></mesh>
    </group>
  );
}

export function JerusalemOutside({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 20 : detail === 1 ? 12 : 8;
  const wall = useTexture(paintWall, 512, 512, [10, 1], 5);
  const grass = useTexture(paintGrass, 256, 256, [160, 160], 3);
  const h = CITY.half, t = CITY.wall, g = CITY.gateW / 2, wh = CITY.wallH;
  const segs = useMemo(() => {
    const out: { cx: number; cz: number; sx: number; sz: number; rep: number }[] = [];
    const edges = [-h - t, ...CITY.gates.flatMap((x) => [x - g, x + g]), h + t];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], b = edges[i + 1], len = b - a, mid = (a + b) / 2;
      out.push({ cx: mid, cz: h + t / 2, sx: len, sz: t, rep: len / 30 }, { cx: mid, cz: -h - t / 2, sx: len, sz: t, rep: len / 30 }, { cx: h + t / 2, cz: mid, sx: t, sz: len, rep: len / 30 }, { cx: -h - t / 2, cz: mid, sx: t, sz: len, rep: len / 30 });
    }
    return out;
  }, [h, t, g]);
  const hills = useMemo<Item[]>(() => Array.from({ length: 18 }, (_, i) => [Math.cos(i * 0.35) * 420, 10, Math.sin(i * 0.35) * 420, 0, 40 + (i % 5) * 14] as Item), []);
  const trees = useMemo(() => { const r = rand(13), tr: Item[] = [], cr: Item[] = []; for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = 190 + r() * 150, x = Math.cos(a) * d, z = Math.sin(a) * d; const s = 1 + r() * 1.2; tr.push([x, 2 * s, z, 0, s]); cr.push([x, 5.5 * s, z, r() * 3, s]); } return { tr, cr }; }, []);
  const gates = useMemo(() => {
    const out: { x: number; z: number; side: number; k: number }[] = [];
    CITY.gates.forEach((o, k) => { out.push({ x: o, z: h + t / 2, side: 0, k }, { x: h + t / 2, z: o, side: 1, k: 3 + k }, { x: o, z: -h - t / 2, side: 2, k: 6 + k }, { x: -h - t / 2, z: o, side: 3, k: 9 + k }); });
    return out;
  }, [h, t]);
  return (
    <group>
      <hemisphereLight args={["#fffbea", "#bfe0a0", 1.35]} />
      <directionalLight position={[-80, 120, 90]} intensity={1.0} color="#fff3cf" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1100, 1100]} /><Mat c="#ffffff" map={grass} r={1} /></mesh>
      <Instances items={hills}><sphereGeometry args={[1, 12, 6]} /><Mat c="#c4e0a8" r={1} /></Instances>
      <Instances items={trees.tr}><cylinderGeometry args={[0.35, 0.5, 4, 6]} /><Mat c="#8a6a46" /></Instances>
      <Instances items={trees.cr}><sphereGeometry args={[2.6, 8, 6]} /><Mat c="#7fbf6a" /></Instances>
      {/* the wall, 144 cubits high, of jasper on twelve foundations (Ap 21:12, 21:17-20) */}
      {segs.map((s, i) => <mesh key={i} position={[s.cx, wh / 2, s.cz]}><boxGeometry args={[s.sx, wh, s.sz]} /><Mat c="#ffffff" map={wall} r={0.35} m={0.1} e="#e8ffe0" ei={0.18} /></mesh>)}
      {gates.map((gt) => <Gate key={gt.k} x={gt.x} z={gt.z} side={gt.side} seg={seg} tribe="" />)}
      {gates.map((gt) => { const vert = gt.side % 2 === 1; return <Angel key={`a${gt.k}`} x={vert ? gt.x + (gt.side === 1 ? 5 : -5) : gt.x + 9.5} z={vert ? gt.z + 9.5 : gt.z + (gt.side === 0 ? 5 : -5)} ry={vert ? (gt.side === 1 ? -Math.PI / 2 : Math.PI / 2) : gt.side === 0 ? 0 : Math.PI} />; })}
      {/* the light: the glory of God, from above the city (Ap 21:23) */}
      <mesh position={[0, 330, 0]}><sphereGeometry args={[60, 12, 8]} /><meshBasicMaterial color="#fff6d0" transparent opacity={0.35} /></mesh>
    </group>
  );
}

export function JerusalemInside({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 16 : detail === 1 ? 10 : 7;
  const street = useTexture(paintGoldStreet, 256, 256, [30, 30], 4);
  const water = useTexture(paintWater, 256, 256, [1, 12], 6);
  const gold = useTexture(paintHammered("#f0c64e"), 128, 128, [2, 2], 7);
  const flow = useRef<Group>(null);
  useFrame(({ clock }) => { water.offset.y = -clock.elapsedTime * 0.12; if (flow.current) flow.current.rotation.y = clock.elapsedTime * 0.1; });
  const h = CITY.half;
  const trees = useMemo(() => {
    const r = rand(7), tr: Item[] = [], cr: Item[] = [], fr: Item[] = [];
    for (const z of TREES_Z) for (const s of [-1, 1]) {
      tr.push([s * 11, 2.6, z, 0, 1]);
      cr.push([s * 11, 6.2, z, 0, 1.15], [s * 11 + 1.4, 5.4, z + 1, 0, 0.8], [s * 11 - 1.4, 5.6, z - 1, 0, 0.85]);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28 + r(), d = 2 + r() * 1.2; fr.push([s * 11 + Math.cos(a) * d, 4.2 + r() * 2.8, z + Math.sin(a) * d, 0, 1]); }
    }
    return { tr, cr, fr: fr.slice(0, 240) };
  }, []);
  const crowd = useMemo(() => { const r = rand(23), b: Item[] = [], hd: Item[] = []; for (let i = 0; i < (detail === 0 ? 90 : 50); i++) { const x = (r() - 0.5) * 240, z = 30 + r() * 110; if (Math.abs(x) < 14) continue; b.push([x, 0.9, z, r() * 6]); hd.push([x, 1.95, z]); } return { b, hd }; }, [detail]);
  const bridges = RIVER.bridges;
  const rainbow = useMemo(() => Array.from({ length: 24 }, (_, i) => { const a = (i / 23) * Math.PI; return [Math.cos(a) * 12, 6 + Math.sin(a) * 12, -6, 0, 1] as Item; }), []);
  return (
    <group>
      <hemisphereLight args={["#fff8de", "#f0d890", 1.1]} />
      <pointLight position={[0, 22, THRONE.at[1]]} intensity={60} distance={260} color="#fff3cf" />
      <pointLight position={[0, 30, 40]} intensity={30} distance={200} color="#fff0c0" />
      {/* the street of pure gold, like transparent glass (Ap 21:21): the whole floor of the city */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[h * 2, h * 2]} /><Mat c="#ffffff" map={street} m={0.5} r={0.18} e="#8a6414" ei={0.35} /></mesh>
      {/* the river of the water of life, clear as crystal, from the throne through the middle of the street (Ap 22:1) */}
      <mesh position={[0, 0.2, (RIVER.z0 + RIVER.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[RIVER.halfW * 2, RIVER.z1 - RIVER.z0]} /><Mat c="#ffffff" map={water} r={0.05} m={0.2} e="#79c8ee" ei={0.5} /></mesh>
      <mesh position={[0, 0.12, RIVER.z1 + 4]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[9, seg + 8]} /><Mat c="#9fdcf2" r={0.05} e="#79c8ee" ei={0.5} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (RIVER.halfW + 0.3), 0.25, (RIVER.z0 + RIVER.z1) / 2]}><boxGeometry args={[0.6, 0.5, RIVER.z1 - RIVER.z0]} /><Mat c="#ffffff" map={gold} m={0.5} r={0.3} /></mesh>)}
      {bridges.map((z) => <group key={z} position={[0, 0, z]}><mesh position={[0, 0.5, 0]}><boxGeometry args={[RIVER.halfW * 2 + 2, 0.5, RIVER.bridgeHalf * 2]} /><Mat c="#ffffff" map={gold} m={0.5} r={0.3} /></mesh>{[-1, 1].map((s) => <mesh key={s} position={[0, 1.2, s * RIVER.bridgeHalf]}><boxGeometry args={[RIVER.halfW * 2 + 2, 0.9, 0.3]} /><Mat c="#ffffff" map={gold} m={0.5} r={0.3} /></mesh>)}</group>)}
      {/* the tree of life on either side of the river, bearing twelve kinds of fruit, with leaves for the healing of the nations (Ap 22:2) */}
      <Instances items={trees.tr}><cylinderGeometry args={[0.45, 0.7, 5.2, 7]} /><Mat c="#8a6a46" /></Instances>
      <Instances items={trees.cr}><sphereGeometry args={[3.2, seg, 6]} /><Mat c="#58b45a" r={0.8} e="#2f7a38" ei={0.15} /></Instances>
      <Instances items={trees.fr}><sphereGeometry args={[0.28, 6, 5]} /><Mat c="#ff9a3c" e="#ff7a1c" ei={0.6} /></Instances>
      {/* the throne of God and of the Lamb: only light, a high seat of crystal on a dais, and a rainbow like emerald around it (Ap 22:1; 4:3); no figure (RA-20) */}
      <group position={[THRONE.at[0], 0, THRONE.at[1]]}>
        {[0, 1, 2].map((k) => <mesh key={k} position={[0, 0.5 + k * 0.7, 0]}><cylinderGeometry args={[THRONE.r - k * 2.4, THRONE.r + 0.4 - k * 2.4, 0.7, seg + 12]} /><Mat c="#ffffff" map={gold} m={0.5} r={0.3} e="#8a6414" ei={0.3} /></mesh>)}
        <mesh position={[0, 3.6, 0]}><boxGeometry args={[3.4, 0.5, 3]} /><Mat c="#eaf8ff" r={0.05} e="#bfe8ff" ei={0.6} o={0.8} /></mesh>
        <mesh position={[0, 5.8, -1.3]}><boxGeometry args={[3.4, 4.4, 0.5]} /><Mat c="#eaf8ff" r={0.05} e="#bfe8ff" ei={0.6} o={0.8} /></mesh>
        <mesh position={[0, 6.2, 0]}><sphereGeometry args={[2.6, 14, 10]} /><meshBasicMaterial color="#fffbe0" transparent opacity={0.35} /></mesh>
        <pointLight position={[0, 6, 0]} intensity={40} distance={90} color="#fff6d0" />
      </group>
      <group position={[THRONE.at[0], 0, THRONE.at[1]]}><Instances items={rainbow}><sphereGeometry args={[0.55, 6, 5]} /><Mat c="#1fae6a" e="#2fe08a" ei={0.9} /></Instances></group>
      <group ref={flow} position={[THRONE.at[0], 8.8, THRONE.at[1]]}><mesh><torusGeometry args={[2.4, 0.05, 5, 24]} /><meshBasicMaterial color="#fffbe0" /></mesh></group>
      {/* the multitude: figures in white robes (Ap 7:9), without faces, standing in the plazas (reconstruction) */}
      <Instances items={crowd.b}><coneGeometry args={[0.38, 1.8, 7]} /><Mat c="#fffaf0" r={0.9} /></Instances>
      <Instances items={crowd.hd}><sphereGeometry args={[0.2, 7, 5]} /><Mat c="#e6c9a8" r={0.9} /></Instances>
    </group>
  );
}

export const JERUSALEM_SCENES: Record<string, (p: { detail: Detail }) => React.JSX.Element> = { jer_outside: JerusalemOutside, jer_inside: JerusalemInside };
