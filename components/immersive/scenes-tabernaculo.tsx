"use client";

// The Tabernacle (Prompt 3.2), enriched: courtyard and tent built from lib/immersive/tabernaculo.ts (measures from Êxodo 25-40). Procedural textures (linen, acacia,
// hammered gold, bronze, goat hair, embroidery), instanced details (sockets, rings, stakes and cords, utensils, camp), animated fire, smoke and lamps, a high priest
// (a stylized figure, no face) and the camp of the tribes. What the text does not describe (laver shape, lampstand height, cherubim, exact tones, roof, the people's
// clothes, the camp's layout) is a reconstruction and is labeled so in the package. God's presence is only light and cloud, never a figure (RA-20).
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, DoubleSide, type Group, type Texture, Vector3 } from "three";
import { Flame, Instances, paintEmbroidery, paintHammered, paintLinen, paintSand, paintWood, Smoke, useTexture } from "./proc";
import { ALTAR, ARK, COURT, DOOR_PILLARS, GATE, INCENSE, LAMPSTAND, LAVER, TABLE, TENT, VEIL_PILLARS, VEIL_Z, courtPosts, tentCenterZ, tentWest } from "@/lib/immersive/tabernaculo";

type Detail = 0 | 1 | 2;
type Item = [number, number, number, number?, number?];
const GOLD = "#e0b53a", SILVER = "#d6d9de", BRONZE = "#b5703c", BLUE = "#33408f", PURPLE = "#7d2a5c", CRIMSON = "#b3202f";
const GOAT = "#4a3d33", RAMS = "#9a3a26", TACHASH = "#2b2623";
const rand = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const Mat = ({ c, r = 0.8, m = 0, map, e, side }: { c: string; r?: number; m?: number; map?: Texture; e?: string; side?: typeof DoubleSide }) => <meshStandardMaterial color={c} roughness={r} metalness={m} map={map} emissive={e} emissiveIntensity={e ? 1.4 : 0} side={side ?? DoubleSide} />;

/** Vertical stripes of blue, purple and crimson (with optional embroidery on top): the colored curtains (gate, door, veil), "obra de bordador". */
function Curtain({ x, y, z, w, h, rotY = 0, embroidery = false }: { x: number; y: number; z: number; w: number; h: number; rotY?: number; embroidery?: boolean }) {
  const tex = useTexture((ctx, tw, th, r) => {
    const cols = [BLUE, PURPLE, CRIMSON], n = 9, sw = tw / n;
    for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i % 3]; ctx.fillRect(i * sw, 0, sw + 1, th); }
    for (let i = 0; i < tw; i += 2) { ctx.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; ctx.fillRect(i, 0, 1, th); }
    if (embroidery) {
      const e = document.createElement("canvas"); e.width = tw; e.height = th; paintEmbroidery(e.getContext("2d")!, tw, th, r);
      ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.55; ctx.drawImage(e, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
  }, 256, 256, [Math.max(1, Math.round(w / 1.6)), 1], 3, [embroidery]);
  return <mesh position={[x, y, z]} rotation={[0, rotY, 0]}><planeGeometry args={[w, h]} /><Mat c="#ffffff" map={tex} r={0.95} /></mesh>;
}

function Posts({ posts, height, seg }: { posts: [number, number][]; height: number; seg: number }) {
  const wood = useTexture(paintWood("#5a3b22", 32, 0.5), 128, 128, [1, 3], 2);
  const bases = useMemo<Item[]>(() => posts.map(([x, z]) => [x, 0.07, z] as Item), [posts]);
  const shafts = useMemo<Item[]>(() => posts.map(([x, z]) => [x, height / 2, z] as Item), [posts, height]);
  const tops = useMemo<Item[]>(() => posts.map(([x, z]) => [x, height + 0.03, z] as Item), [posts, height]);
  const rings = useMemo<Item[]>(() => posts.map(([x, z]) => [x, height - 0.35, z] as Item), [posts, height]);
  return (
    <>
      <Instances items={bases}><cylinderGeometry args={[0.15, 0.17, 0.14, seg]} /><Mat c={BRONZE} m={0.35} r={0.45} /></Instances>
      <Instances items={shafts}><cylinderGeometry args={[0.07, 0.08, height, seg]} /><Mat c="#9a7a56" map={wood} r={0.9} /></Instances>
      <Instances items={tops}><cylinderGeometry args={[0.11, 0.08, 0.07, seg]} /><Mat c={SILVER} m={0.4} r={0.35} /></Instances>
      <Instances items={rings}><torusGeometry args={[0.085, 0.02, 5, 8]} /><Mat c={SILVER} m={0.4} r={0.35} /></Instances>
    </>
  );
}

export function TabernacleCourt({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 14 : detail === 1 ? 8 : 5;
  const posts = courtPosts();
  const { halfW, halfL, height } = COURT;
  const sand = useTexture(paintSand, 256, 256, [70, 70], 4);
  const linen = useTexture(paintLinen(), 128, 128, [18, 2], 5);
  const hammered = useTexture(paintHammered("#b5703c"), 128, 128, [2, 2], 6);
  const stones = useMemo<Item[]>(() => { const r = rand(9); return Array.from({ length: detail === 0 ? 140 : 80 }, () => { const x = (r() - 0.5) * 140, z = (r() - 0.5) * 140; return [x, 0.1, z, r() * 3, 0.15 + r() * 0.5] as Item; }).filter(([x, , z]) => !(Math.abs(x) < halfW + 1 && Math.abs(z) < halfL + 1)); }, [detail, halfW, halfL]);
  const hills = useMemo<Item[]>(() => Array.from({ length: 14 }, (_, i) => [Math.cos(i * 0.45) * 150, 6, Math.sin(i * 0.45) * 150, 0, 14 + (i % 4) * 7] as Item), []);
  // cords from the top of the posts to bronze stakes in the sand (Êx 27:19; 35:18), one family per side
  const cords = useMemo(() => {
    const out: { items: Item[]; ry: number }[] = [];
    const side = (filter: (p: [number, number]) => boolean, ry: number, off: (p: [number, number]) => [number, number]) => out.push({ ry, items: posts.filter(filter).map((p) => { const [dx, dz] = off(p); return [p[0] + dx, height - 0.15, p[1] + dz, ry] as Item; }) });
    side(([x]) => x > halfW - 0.01, 0, () => [0.7, 0]); side(([x]) => x < -halfW + 0.01, Math.PI, () => [-0.7, 0]);
    side(([, z]) => z < -halfL + 0.01, Math.PI / 2, () => [0, -0.7]);
    return out;
  }, [posts, halfW, halfL, height]);
  const stakes = useMemo<Item[]>(() => cords.flatMap((c) => c.items.map(([x, , z, ry = 0]) => [x + Math.cos(ry) * 1.65, 0.08, z - Math.sin(ry) * 1.65, 0] as Item)), [cords]);
  const utensils = useMemo(() => ({ pots: [[0, 0, 0], [0.55, 0, 0.1], [1.1, 0, -0.1]] as [number, number, number][], tools: [[-0.6, 0.02, 0.3], [-0.6, 0.02, 0.5], [-0.6, 0.02, 0.7]] as [number, number, number][] }), []);

  return (
    <group>
      <hemisphereLight args={["#e6eef6", "#9a8458", 0.75]} />
      <directionalLight position={[40, 60, 25]} intensity={1.9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[420, 420]} /><Mat c="#d7c096" map={sand} r={1} side={undefined} /></mesh>
      <Instances items={hills}><sphereGeometry args={[1, 10, 6]} /><Mat c="#a38c64" r={1} /></Instances>
      <Instances items={stones}><dodecahedronGeometry args={[1, 0]} /><Mat c="#9b8d72" r={1} /></Instances>
      <Posts posts={posts} height={height} seg={seg} />
      {/* fine linen curtains, 5 cubits high (Êx 27:9-18) */}
      {[-halfW, halfW].map((x) => <mesh key={x} position={[x, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[halfL * 2, height * 0.92]} /><Mat c="#ffffff" map={linen} r={0.95} /></mesh>)}
      <mesh position={[0, height / 2, -halfL]}><planeGeometry args={[halfW * 2, height * 0.92]} /><Mat c="#ffffff" map={linen} r={0.95} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (halfW + GATE.half) / 2, height / 2, halfL]}><planeGeometry args={[halfW - GATE.half, height * 0.92]} /><Mat c="#ffffff" map={linen} r={0.95} /></mesh>)}
      {/* silver fillets (bands) along the top of the curtains, hooks of silver (Êx 27:10-11) */}
      {[-halfW, halfW].map((x) => <mesh key={x} position={[x, height * 0.93, 0]}><boxGeometry args={[0.05, 0.05, halfL * 2]} /><Mat c={SILVER} m={0.4} r={0.35} /></mesh>)}
      <mesh position={[0, height * 0.93, -halfL]}><boxGeometry args={[halfW * 2, 0.05, 0.05]} /><Mat c={SILVER} m={0.4} r={0.35} /></mesh>
      {/* the gate curtain, 20 cubits, drawn aside: blue, purple, crimson (Êx 27:16) */}
      <Curtain x={-(GATE.half + GATE.opening) / 2} y={height / 2} z={halfL} w={GATE.half - GATE.opening} h={height * 0.92} />
      <Curtain x={(GATE.half + GATE.opening) / 2} y={height / 2} z={halfL} w={GATE.half - GATE.opening} h={height * 0.92} />
      {/* cords and bronze stakes */}
      {cords.map((c, i) => <Instances key={i} items={c.items}><cylinderGeometry args={[0.012, 0.012, 1.9, 4]} /><Mat c="#cfc2a6" r={1} /></Instances>)}
      <Instances items={stakes}><coneGeometry args={[0.05, 0.3, 5]} /><Mat c={BRONZE} m={0.4} r={0.5} /></Instances>

      {/* the altar of burnt offering: acacia covered with bronze, 5 x 5 x 3 cubits, horns, a grating halfway down (Êx 27:1-8), no steps (Êx 20:26) */}
      <group position={[ALTAR.at[0], 0, ALTAR.at[1]]}>
        <mesh position={[0, ALTAR.height / 2, 0]}><boxGeometry args={[ALTAR.side, ALTAR.height, ALTAR.side]} /><Mat c="#c98a52" map={hammered} m={0.35} r={0.5} /></mesh>
        <mesh position={[0, ALTAR.height * 0.5, 0]}><boxGeometry args={[ALTAR.side + 0.14, 0.1, ALTAR.side + 0.14]} /><Mat c={BRONZE} m={0.4} r={0.45} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (ALTAR.side / 2 - 0.08), ALTAR.height + 0.13, sz * (ALTAR.side / 2 - 0.08)]}><coneGeometry args={[0.1, 0.28, seg]} /><Mat c={BRONZE} m={0.4} r={0.45} /></mesh>)}
        {[[-0.4, 0, 0.3, 0.3], [0.4, 0, -0.2, -0.5], [0, 0.18, 0, 1.2]].map(([x, y, z, r], i) => <mesh key={i} position={[x, ALTAR.height + 0.1 + y, z]} rotation={[0, r, 1.57]}><cylinderGeometry args={[0.08, 0.08, 1.2, 6]} /><Mat c="#5a3b22" /></mesh>)}
        <Flame size={0.8} intensity={detail < 2 ? 7 : 0} position={[0, ALTAR.height + 0.55, 0]} />
        {detail < 2 && <Smoke count={16} height={7} spread={0.7} color="#6b655c" radius={0.4} position={[0, ALTAR.height + 1.2, 0]} />}
      </group>
      {/* the altar's utensils on the ground beside it: pots, shovels, basins, forks, firepans (Êx 27:3) */}
      <group position={[ALTAR.at[0] + ALTAR.side / 2 + 0.9, 0, ALTAR.at[1] - 0.6]}>
        {utensils.pots.map(([x, y, z], i) => <mesh key={i} position={[x, 0.2 + y, z]}><cylinderGeometry args={[0.22, 0.17, 0.38, 8]} /><Mat c={BRONZE} m={0.45} r={0.45} /></mesh>)}
        {utensils.tools.map(([x, y, z], i) => <mesh key={i} position={[x, 0.04 + y, z]} rotation={[0, 0.25 * i, 0]}><boxGeometry args={[1.5, 0.04, 0.07]} /><Mat c={BRONZE} m={0.45} r={0.45} /></mesh>)}
        {[0.3, 1.0].map((x) => <mesh key={x} position={[x, 0.07, 0.9]} rotation={[Math.PI, 0, 0]}><sphereGeometry args={[0.3, 8, 4, 0, Math.PI * 2, 0, 1.2]} /><Mat c={BRONZE} m={0.45} r={0.45} /></mesh>)}
      </group>

      {/* the laver of bronze: shape and size are a reconstruction (Êx 30:17-21; 38:8): a basin on a pedestal, water that catches the light */}
      <group position={[LAVER.at[0], 0, LAVER.at[1]]}>
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.55, 0.65, 0.16, seg + 6]} /><Mat c="#c98a52" map={hammered} m={0.4} r={0.45} /></mesh>
        <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.2, 0.36, 0.8, seg + 4]} /><Mat c="#c98a52" map={hammered} m={0.4} r={0.45} /></mesh>
        <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.72, 0.32, 0.3, seg + 6]} /><Mat c="#c98a52" map={hammered} m={0.4} r={0.45} /></mesh>
        <mesh position={[0, 1.16, 0]}><torusGeometry args={[0.72, 0.035, 5, seg + 10]} /><Mat c={BRONZE} m={0.4} r={0.4} /></mesh>
        <mesh position={[0, 1.12, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.68, seg + 6]} /><meshStandardMaterial color="#6fb0d0" roughness={0.05} metalness={0.3} /></mesh>
      </group>

      <Priests detail={detail} />
      <Camp />
    </group>
  );
}

/** The high priest (éfode, peitoral of 12 stones, azure robe with pomegranates, mitre with the gold plate: Êx 28) and two priests in linen. Stylized, no faces. */
function Priests({ detail }: { detail: Detail }) {
  const stones = ["#c0392b", "#e8a33a", "#e8d44a", "#2f8f5b", "#3a6fb0", "#6a3fa0", "#b0a090", "#2a8f9f", "#a05030", "#d0b030", "#5a8f3a", "#50a0c0"];
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = Math.PI + Math.sin(clock.elapsedTime * 0.4) * 0.1; }); // he turns a little, calmly
  const Person = ({ x, z, high = false, ry = 0 }: { x: number; z: number; high?: boolean; ry?: number }) => (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.28, 0.42, 1.55, 10]} /><Mat c={high ? BLUE : "#f2ecdd"} r={0.9} /></mesh>
      <mesh position={[0, 1.62, 0]}><sphereGeometry args={[0.19, 10, 8]} /><Mat c="#c99a73" r={0.9} /></mesh>
      <mesh position={[0, 1.18, 0]}><cylinderGeometry args={[0.3, 0.3, 0.1, 10]} /><Mat c={high ? GOLD : "#d9d0bb"} m={high ? 0.5 : 0} r={0.5} /></mesh>
      {high ? (
        <>
          <mesh position={[0, 1.28, 0.27]}><boxGeometry args={[0.46, 0.46, 0.05]} /><Mat c={GOLD} m={0.5} r={0.4} /></mesh>
          {stones.map((c, i) => <mesh key={c} position={[-0.165 + (i % 4) * 0.11, 1.4 - Math.floor(i / 4) * 0.115, 0.3]}><boxGeometry args={[0.09, 0.09, 0.03]} /><Mat c={c} r={0.3} m={0.2} /></mesh>)}
          <mesh position={[0, 1.78, 0]}><cylinderGeometry args={[0.2, 0.17, 0.16, 10]} /><Mat c="#f6f1e4" /></mesh>
          <mesh position={[0, 1.78, 0.19]}><boxGeometry args={[0.2, 0.05, 0.02]} /><Mat c={GOLD} m={0.5} r={0.4} /></mesh>
          {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[Math.sin((i / 8) * 6.28) * 0.4, 0.28, Math.cos((i / 8) * 6.28) * 0.4]}><sphereGeometry args={[0.045, 5, 4]} /><Mat c={i % 2 ? GOLD : CRIMSON} m={i % 2 ? 0.5 : 0} /></mesh>)}
        </>
      ) : <mesh position={[0, 1.76, 0]}><coneGeometry args={[0.17, 0.22, 8]} /><Mat c="#f6f1e4" /></mesh>}
    </group>
  );
  return (
    <group>
      <group ref={g} position={[ALTAR.at[0] + 4.2, 0, ALTAR.at[1] + 1.0]}><Person x={0} z={0} high /></group>
      <Person x={ALTAR.at[0] - 3.6} z={ALTAR.at[1] + 2.0} ry={1.2} />
      {detail < 2 && <Person x={ALTAR.at[0] - 4.6} z={ALTAR.at[1] - 1.6} ry={0.6} />}
    </group>
  );
}

/** The camp of the tribes, around the Tabernacle at a distance and the Levites close to it (Nm 2-3): a reconstruction, the distance is not given. */
function Camp() {
  const tents = useMemo<{ cones: Item[]; walls: Item[] }>(() => {
    const r = rand(31), cones: Item[] = [], walls: Item[] = [];
    // Levites close to the court on the four sides, then the tribes beyond, in four groups
    const groups: [number, number, number, number][] = [[0, 42, 14, 5], [-0, -52, 14, 5], [26, 0, 5, 14], [-26, 0, 5, 14], [60, 0, 26, 18], [-60, 0, 26, 18], [0, 80, 24, 14], [0, -90, 24, 14]];
    for (const [cx, cz, hw, hl] of groups) for (let i = 0; i < 14; i++) { const x = cx + (r() - 0.5) * 2 * hw, z = cz + (r() - 0.5) * 2 * hl; if (Math.abs(x) < 15 && Math.abs(z) < 28) continue; const s = 0.9 + r() * 0.5; walls.push([x, 0.9 * s, z, r() * 3, s]); cones.push([x, 2.2 * s, z, r() * 3, s]); }
    return { cones, walls };
  }, []);
  return (
    <group>
      <Instances items={tents.walls}><cylinderGeometry args={[1.5, 1.7, 1.8, 6]} /><Mat c="#5a4a3c" r={1} /></Instances>
      <Instances items={tents.cones}><coneGeometry args={[1.9, 1.2, 6]} /><Mat c="#3d3228" r={1} /></Instances>
    </group>
  );
}

function CherubWings({ y, z }: { y: number; z: number }) {
  // abstract wings (no faces): two layered curved panels rising over the mercy seat, tips toward each other (Êx 25:20)
  const curve = useMemo(() => new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0.12, 0.26, 0), new Vector3(0.3, 0.38, 0), new Vector3(0.5, 0.3, 0)]), []);
  const pts = useMemo(() => curve.getPoints(12), [curve]);
  return (
    <group position={[0, y, z]}>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.16, 0.4, 0.16]} /><Mat c={GOLD} m={0.7} r={0.3} /></mesh>
      <mesh position={[0, 0.46, 0]}><sphereGeometry args={[0.1, 8, 6]} /><Mat c={GOLD} m={0.7} r={0.3} /></mesh>
      {[-1, 1].map((s) => pts.slice(0, -1).map((p, i) => <mesh key={`${s}${i}`} position={[s * p.x, p.y + 0.12, 0]} rotation={[0, 0, -s * Math.atan2(pts[i + 1].y - p.y, pts[i + 1].x - p.x)]}><boxGeometry args={[0.1, 0.03, 0.24 - i * 0.012]} /><Mat c={GOLD} m={0.7} r={0.3} /></mesh>))}
    </group>
  );
}

export function TabernacleTent({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 12 : detail === 1 ? 8 : 5;
  const zc = tentCenterZ(), len = TENT.length, hw = TENT.halfW, h = TENT.height, west = tentWest();
  const gold = useTexture(paintHammered("#e0b53a"), 128, 128, [1, 2], 7);
  const goat = useTexture((ctx, w, hh, r) => { ctx.fillStyle = GOAT; ctx.fillRect(0, 0, w, hh); for (let i = 0; i < 900; i++) { ctx.strokeStyle = `rgba(${60 + r() * 50},${50 + r() * 40},${40 + r() * 30},${0.5})`; ctx.lineWidth = 1; ctx.beginPath(); const x = r() * w, y = r() * hh; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y + 10 + r() * 14); ctx.stroke(); } }, 128, 128, [10, 2], 8);
  const rams = useTexture(paintWood(RAMS, 40, 0.5), 128, 128, [8, 2], 9);
  const embroidered = useTexture(paintEmbroidery, 256, 256, [4, 8], 11);
  const floor = useTexture(paintWood("#6b4a2e", 48, 0.3), 128, 128, [2, 6], 12);
  const holyZ = (TENT.door + VEIL_Z()) / 2;
  const boardsZ = useMemo(() => Array.from({ length: 20 }, (_, i) => TENT.door - (i + 0.5) * TENT.board), []);
  const sockets = useMemo<Item[]>(() => [...boardsZ.flatMap((z) => [[-hw, 0.1, z - 0.18], [-hw, 0.1, z + 0.18], [hw, 0.1, z - 0.18], [hw, 0.1, z + 0.18]] as Item[]), ...Array.from({ length: 6 }, (_, i) => [-hw + (i + 0.5) * ((hw * 2) / 6), 0.1, west] as Item)], [boardsZ, hw, west]);
  const rings = useMemo<Item[]>(() => boardsZ.flatMap((z) => [-1, 1].flatMap((s) => [1.2, 4.9, 8.6].map((y) => [s * (hw - 0.09), y, z, 0] as Item))), [boardsZ, hw]);
  const bars = useMemo<Item[]>(() => [2.0, 4.5, 7.0].flatMap((y) => [-1, 1].map((s) => [s * (hw - 0.14), y, zc, 0] as Item)), [hw, zc]);
  const clasps = useMemo<Item[]>(() => Array.from({ length: 18 }, (_, i) => [0, h - 0.04, TENT.door - 1 - i * (len - 2) / 17, 0] as Item), [h, len]);

  return (
    <group>
      {/* floor inside the tent */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, zc]}><planeGeometry args={[hw * 2, len]} /><Mat c="#8a6a45" map={floor} r={0.9} /></mesh>
      {/* boards of acacia covered with gold: 20 per side, 6 at the back, each on two silver sockets (Êx 26:15-25) */}
      {[-hw, hw].map((x) => boardsZ.map((z) => <mesh key={`${x}${z}`} position={[x, h / 2, z]}><boxGeometry args={[0.14, h, TENT.board * 0.94]} /><Mat c="#ffffff" map={gold} m={0.55} r={0.35} /></mesh>))}
      {Array.from({ length: 6 }, (_, i) => <mesh key={`w${i}`} position={[-hw + (i + 0.5) * ((hw * 2) / 6), h / 2, west]}><boxGeometry args={[((hw * 2) / 6) * 0.94, h, 0.14]} /><Mat c="#ffffff" map={gold} m={0.55} r={0.35} /></mesh>)}
      <Instances items={sockets}><boxGeometry args={[0.34, 0.2, 0.32]} /><Mat c={SILVER} m={0.5} r={0.3} /></Instances>
      <Instances items={rings}><torusGeometry args={[0.07, 0.02, 5, 8]} /><Mat c={GOLD} m={0.6} r={0.3} /></Instances>
      <Instances items={bars}><boxGeometry args={[0.1, 0.12, len - 0.4]} /><Mat c={GOLD} m={0.6} r={0.3} /></Instances>
      {/* the coverings outside, from inside out: goat hair, rams' skins dyed red, fine skins; the flat roof is a reconstruction */}
      {[-1, 1].map((s) => <mesh key={`o${s}`} position={[s * (hw + 0.12), h * 0.52, zc]}><boxGeometry args={[0.1, h * 1.04, len + 0.3]} /><Mat c="#ffffff" map={goat} r={1} /></mesh>)}
      <mesh position={[0, h * 0.52, west - 0.12]}><boxGeometry args={[hw * 2 + 0.5, h * 1.04, 0.1]} /><Mat c="#ffffff" map={goat} r={1} /></mesh>
      {[-1, 1].map((s) => <mesh key={`r${s}`} position={[s * (hw + 0.22), h * 0.8, zc]}><boxGeometry args={[0.08, h * 0.5, len + 0.5]} /><Mat c="#ffffff" map={rams} r={1} /></mesh>)}
      {/* linen ceiling with embroidered cherubim, clasps of gold and loops of blue (Êx 26:1-6) */}
      <mesh position={[0, h - 0.02, zc]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[hw * 2, len]} /><Mat c="#ffffff" map={embroidered} r={0.95} /></mesh>
      <Instances items={clasps}><boxGeometry args={[hw * 2, 0.08, 0.1]} /><Mat c={GOLD} m={0.6} r={0.3} /></Instances>
      <mesh position={[0, h + 0.05, zc]}><boxGeometry args={[hw * 2 + 0.5, 0.06, len + 0.5]} /><Mat c={BLUE} r={0.95} side={undefined} /></mesh>
      <mesh position={[0, h + 0.12, zc]}><boxGeometry args={[hw * 2 + 0.6, 0.06, len + 0.7]} /><Mat c="#ffffff" map={goat} r={1} side={undefined} /></mesh>
      <mesh position={[0, h + 0.19, zc]}><boxGeometry args={[hw * 2 + 0.7, 0.06, len + 0.9]} /><Mat c="#ffffff" map={rams} r={1} side={undefined} /></mesh>
      <mesh position={[0, h + 0.26, zc]}><boxGeometry args={[hw * 2 + 0.8, 0.06, len + 1.1]} /><Mat c={TACHASH} r={0.45} side={undefined} /></mesh>

      {/* door: 5 pillars of acacia covered with gold on bronze bases, curtain drawn aside (Êx 26:36-37) */}
      {DOOR_PILLARS.map((x) => <group key={x} position={[x, 0, TENT.door]}><mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.13, 0.16, 0.16, seg]} /><Mat c={BRONZE} m={0.4} r={0.45} /></mesh><mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.075, 0.075, h, seg]} /><Mat c="#ffffff" map={gold} m={0.55} r={0.35} /></mesh><mesh position={[0, h + 0.03, 0]}><cylinderGeometry args={[0.11, 0.08, 0.08, seg]} /><Mat c={GOLD} m={0.6} r={0.3} /></mesh></group>)}
      <Curtain x={-1.55} y={h / 2} z={TENT.door} w={1.1} h={h * 0.98} />
      <Curtain x={1.55} y={h / 2} z={TENT.door} w={1.1} h={h * 0.98} />

      {/* the veil: 4 pillars on silver bases, with cherubim, drawn open so the Most Holy Place can be SEEN, never entered (Êx 26:31-33) */}
      {VEIL_PILLARS.map((x) => <group key={x} position={[x, 0, VEIL_Z()]}><mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.13, 0.16, 0.16, seg]} /><Mat c={SILVER} m={0.5} r={0.3} /></mesh><mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.075, 0.075, h, seg]} /><Mat c="#ffffff" map={gold} m={0.55} r={0.35} /></mesh><mesh position={[0, h + 0.03, 0]}><cylinderGeometry args={[0.11, 0.08, 0.08, seg]} /><Mat c={GOLD} m={0.6} r={0.3} /></mesh></group>)}
      <Curtain x={-1.35} y={h / 2} z={VEIL_Z()} w={1.3} h={h * 0.98} embroidery />
      <Curtain x={1.35} y={h / 2} z={VEIL_Z()} w={1.3} h={h * 0.98} embroidery />

      {/* the table (north): acacia covered with pure gold, 2 x 1 x 1.5 cubits, with a crown, rings and staves; dishes and two rows of bread (Êx 25:23-30) */}
      <group position={[TABLE.at[0], 0, TABLE.at[1]]}>
        <mesh position={[0, TABLE.height - 0.03, 0]}><boxGeometry args={[TABLE.size[0], 0.06, TABLE.size[1]]} /><Mat c="#ffffff" map={gold} m={0.6} r={0.3} /></mesh>
        <mesh position={[0, TABLE.height + 0.02, 0]}><boxGeometry args={[TABLE.size[0] + 0.04, 0.04, TABLE.size[1] + 0.04]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
        <mesh position={[0, TABLE.height * 0.6, 0]}><boxGeometry args={[TABLE.size[0] - 0.05, 0.07, TABLE.size[1] - 0.05]} /><Mat c={GOLD} m={0.6} r={0.3} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <group key={`${sx}${sz}`}><mesh position={[sx * (TABLE.size[0] / 2 - 0.03), TABLE.height / 2, sz * (TABLE.size[1] / 2 - 0.03)]}><boxGeometry args={[0.05, TABLE.height, 0.05]} /><Mat c={GOLD} m={0.6} r={0.3} /></mesh><mesh position={[sx * (TABLE.size[0] / 2), TABLE.height - 0.12, sz * (TABLE.size[1] / 2 - 0.05)]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.04, 0.012, 4, 8]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh></group>)}
        {[-1, 1].map((s) => <mesh key={s} position={[s * (TABLE.size[0] / 2 + 0.06), TABLE.height - 0.12, 0]}><boxGeometry args={[0.03, 0.03, TABLE.size[1] + 0.4]} /><Mat c="#5a3b22" /></mesh>)}
        {[-1, 1].map((row) => [0, 1, 2].map((k) => <mesh key={`${row}${k}`} position={[row * 0.12, TABLE.height + 0.07 + k * 0.07, 0]}><boxGeometry args={[0.18, 0.06, TABLE.size[1] * 0.8]} /><Mat c="#c99a52" r={0.9} /></mesh>))}
        {[-0.28, 0.28].map((z) => <mesh key={z} position={[0.28, TABLE.height + 0.05, z]}><cylinderGeometry args={[0.07, 0.05, 0.04, 8]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>)}
      </group>

      {/* the lampstand (south): pure gold in one piece, 6 curved arms with almond-shaped cups, knops and flowers, 7 lamps (Êx 25:31-40); height and arm shape: reconstruction */}
      <Lampstand detail={detail} />

      {/* the altar of incense (before the veil): gold, 1 x 1 x 2 cubits, horns and a crown of gold (Êx 30:1-10) */}
      <group position={[INCENSE.at[0], 0, INCENSE.at[1]]}>
        <mesh position={[0, INCENSE.height / 2, 0]}><boxGeometry args={[INCENSE.size, INCENSE.height, INCENSE.size]} /><Mat c="#ffffff" map={gold} m={0.6} r={0.3} /></mesh>
        <mesh position={[0, INCENSE.height - 0.02, 0]}><boxGeometry args={[INCENSE.size + 0.06, 0.05, INCENSE.size + 0.06]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (INCENSE.size / 2 - 0.03), INCENSE.height + 0.07, sz * (INCENSE.size / 2 - 0.03)]}><coneGeometry args={[0.045, 0.13, 5]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>)}
        <mesh position={[0, INCENSE.height + 0.08, 0]}><cylinderGeometry args={[0.13, 0.1, 0.07, 8]} /><Mat c="#3a2a1a" r={0.9} /></mesh>
        <Smoke count={12} height={3.2} spread={0.3} color="#e9e3d6" radius={0.16} position={[0, INCENSE.height + 0.15, 0]} />
      </group>

      {/* the ark (seen beyond the veil): acacia covered with gold, 2.5 x 1.5 x 1.5 cubits, a crown, four rings and staves, the mercy seat and two abstract cherubim, no faces (Êx 25:10-22) */}
      <group position={[ARK.at[0], 0, ARK.at[1]]}>
        <mesh position={[0, ARK.height / 2, 0]}><boxGeometry args={[ARK.size[1], ARK.height, ARK.size[0]]} /><Mat c="#ffffff" map={gold} m={0.65} r={0.3} /></mesh>
        <mesh position={[0, ARK.height * 0.92, 0]}><boxGeometry args={[ARK.size[1] + 0.07, 0.08, ARK.size[0] + 0.07]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
        <mesh position={[0, ARK.height + 0.02, 0]}><boxGeometry args={[ARK.size[1] + 0.04, 0.05, ARK.size[0] + 0.04]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
        {[-1, 1].map((sx) => [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} position={[sx * (ARK.size[1] / 2 + 0.02), ARK.height * 0.78, sz * (ARK.size[0] / 2 - 0.18)]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.05, 0.015, 4, 8]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>))}
        {[-1, 1].map((sx) => <mesh key={sx} position={[sx * (ARK.size[1] / 2 + 0.07), ARK.height * 0.78, 0]}><boxGeometry args={[0.045, 0.045, ARK.size[0] + 0.7]} /><Mat c="#6a4a2a" r={0.8} /></mesh>)}
        {[-1, 1].map((s) => <CherubWings key={s} y={ARK.height + 0.05} z={s * (ARK.size[0] / 2 - 0.15)} />)}
        {/* the presence is only light (RA-20) */}
        <mesh position={[0, ARK.height + 0.9, 0]}><sphereGeometry args={[0.55, 12, 8]} /><meshBasicMaterial color="#fff4cc" transparent opacity={0.2} /></mesh>
        <pointLight position={[0, ARK.height + 0.9, 0]} intensity={4} distance={8} color="#fff0c0" />
      </group>
      {detail < 2 && <pointLight position={[0, h * 0.7, holyZ]} intensity={1.6} distance={12} color="#ffe2a8" />}

      <Cloud h={h} zc={zc} />
    </group>
  );
}

function Lampstand({ detail }: { detail: Detail }) {
  const gold = useTexture(paintHammered("#e0b53a"), 128, 128, [1, 1], 7);
  const ht = LAMPSTAND.height, spread = 0.2;
  const arms = useMemo(() => [-3, -2, -1, 1, 2, 3].map((k) => {
    const s = Math.sign(k), n = Math.abs(k), top = ht - 0.05 - (n === 1 ? 0.1 : n === 2 ? 0.05 : 0), x1 = k * spread;
    const curve = new CatmullRomCurve3([new Vector3(0, 0.62 + n * 0.12, 0), new Vector3(s * 0.12, 0.55 + n * 0.1, 0), new Vector3(x1 * 0.9, 0.7 + n * 0.1, 0), new Vector3(x1, top - 0.2, 0)]);
    return { k, curve, top, x1 };
  }), [ht]);
  return (
    <group position={[LAMPSTAND.at[0], 0, LAMPSTAND.at[1]]}>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.24, 0.3, 0.1, 8]} /><Mat c="#ffffff" map={gold} m={0.65} r={0.3} /></mesh>
      <mesh position={[0, ht / 2, 0]}><cylinderGeometry args={[0.035, 0.05, ht, 8]} /><Mat c="#ffffff" map={gold} m={0.65} r={0.3} /></mesh>
      {[0.4, 0.8, 1.15].map((y) => <mesh key={y} position={[0, y, 0]}><sphereGeometry args={[0.07, 8, 6]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>)}
      {[0.55, 0.95].map((y) => <mesh key={y} position={[0, y, 0]} scale={[1, 1.5, 1]}><sphereGeometry args={[0.055, 8, 6]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>)}
      {arms.map(({ k, curve, top, x1 }) => (
        <group key={k}>
          <mesh><tubeGeometry args={[curve, 14, 0.017, 5, false]} /><Mat c="#ffffff" map={gold} m={0.65} r={0.3} /></mesh>
          {[0.45, 0.65].map((t) => { const p = curve.getPoint(t); return <mesh key={t} position={[p.x, p.y, p.z]} scale={[1, 1.4, 1]}><sphereGeometry args={[0.032, 6, 5]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>; })}
          <mesh position={[x1, top - 0.1, 0]}><cylinderGeometry args={[0.05, 0.03, 0.1, 8]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
          <mesh position={[x1, top, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.04, 0.012, 4, 8]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
          <Flame size={0.07} intensity={0} position={[x1, top + 0.08, 0]} />
        </group>
      ))}
      <mesh position={[0, ht - 0.02, 0]}><cylinderGeometry args={[0.05, 0.03, 0.1, 8]} /><Mat c={GOLD} m={0.7} r={0.25} /></mesh>
      <Flame size={0.08} intensity={detail < 2 ? 5 : 2} position={[0, ht + 0.06, 0]} />
    </group>
  );
}

/** The cloud over the tent (Êx 40:34-38): soft puffs that drift slowly; light and cloud, never a figure. */
function Cloud({ h, zc }: { h: number; zc: number }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.children.forEach((c, i) => { c.position.x = Math.sin(clock.elapsedTime * 0.05 + i) * 2.6; c.position.y = h + 3.4 + i * 0.35 + Math.sin(clock.elapsedTime * 0.12 + i * 2) * 0.12; }); });
  return (
    <group ref={g} position={[0, 0, zc]}>
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[0, h + 3.4 + i * 0.35, (i - 2) * 1.6]} scale={[2 + (i % 2) * 0.6, 1.1, 1.7]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#f6f2ea" transparent opacity={0.5} roughness={1} /></mesh>)}
    </group>
  );
}

export const TABERNACLE_SCENES: Record<string, (p: { detail: Detail }) => React.JSX.Element> = { tabernacle_court: TabernacleCourt, tabernacle_tent: TabernacleTent };

