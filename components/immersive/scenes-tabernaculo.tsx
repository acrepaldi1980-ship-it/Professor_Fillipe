"use client";

// The Tabernacle (Prompt 3.2): courtyard and tent built from lib/immersive/tabernaculo.ts (measures from Êxodo 25-40). Low poly, flat colors,
// light by level of detail. What the text does not describe (laver shape, lampstand height, cherubim, exact tones, roof geometry) is a
// reconstruction and is labeled so in the package. God's presence is only light and cloud, never a figure (RA-20).
import { useLayoutEffect, useRef } from "react";
import { DoubleSide, type InstancedMesh, Matrix4 } from "three";
import { ALTAR, ARK, COURT, DOOR_PILLARS, GATE, INCENSE, LAMPSTAND, LAVER, TABLE, TENT, VEIL_PILLARS, VEIL_Z, courtPosts, tentCenterZ, tentWest } from "@/lib/immersive/tabernaculo";

type Detail = 0 | 1 | 2;
const GOLD = "#d9a92b", SILVER = "#cfd2d8", BRONZE = "#a8683a", LINEN = "#efe6cf", BLUE = "#33408f", PURPLE = "#7d2a5c", CRIMSON = "#b3202f";
const ACACIA = "#5a3b22", GOAT = "#3a312b", RAMS = "#8a2f1f", TACHASH = "#26221f", SAND = "#d7c096";
const Mat = ({ c: col, r = 0.8, m = 0, e }: { c: string; r?: number; m?: number; e?: string }) => <meshStandardMaterial color={col} roughness={r} metalness={m} emissive={e} emissiveIntensity={e ? 1.4 : 0} side={DoubleSide} />;
const Metal = ({ c: col }: { c: string }) => <Mat c={col} r={0.45} m={0.25} />;

/** Vertical stripes of blue, purple and crimson: the colored curtains (gate, door, veil), "obra de bordador". */
function Stripes({ x, y, z, w, h, rotY = 0 }: { x: number; y: number; z: number; w: number; h: number; rotY?: number }) {
  const cols = [BLUE, PURPLE, CRIMSON];
  const n = Math.max(3, Math.round(w / 0.25));
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {Array.from({ length: n }, (_, i) => <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / n), 0, 0]}><boxGeometry args={[w / n, h, 0.05]} /><Mat c={cols[i % 3]} r={0.9} /></mesh>)}
    </group>
  );
}

function Posts({ posts, height, seg }: { posts: [number, number][]; height: number; seg: number }) {
  const base = useRef<InstancedMesh>(null), shaft = useRef<InstancedMesh>(null), top = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new Matrix4();
    posts.forEach(([x, z], i) => {
      base.current?.setMatrixAt(i, m.makeTranslation(x, 0.06, z));
      shaft.current?.setMatrixAt(i, m.makeTranslation(x, height / 2, z));
      top.current?.setMatrixAt(i, m.makeTranslation(x, height + 0.03, z));
    });
    for (const r of [base, shaft, top]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  }, [posts, height]);
  return (
    <>
      <instancedMesh ref={base} args={[undefined, undefined, posts.length]}><cylinderGeometry args={[0.14, 0.16, 0.12, seg]} /><Metal c={BRONZE} /></instancedMesh>
      <instancedMesh ref={shaft} args={[undefined, undefined, posts.length]}><cylinderGeometry args={[0.07, 0.08, height, seg]} /><Mat c={ACACIA} /></instancedMesh>
      <instancedMesh ref={top} args={[undefined, undefined, posts.length]}><cylinderGeometry args={[0.1, 0.08, 0.06, seg]} /><Metal c={SILVER} /></instancedMesh>
    </>
  );
}

export function TabernacleCourt({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 14 : detail === 1 ? 8 : 5;
  const posts = courtPosts();
  const { halfW, halfL, height } = COURT;
  const side = (x: number) => <mesh position={[x, height / 2, 0]}><boxGeometry args={[0.05, height * 0.92, halfL * 2]} /><Mat c={LINEN} r={0.95} /></mesh>;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[160, 160]} /><Mat c={SAND} r={1} /></mesh>
      {/* the posts: bronze bases, silver tops (Êx 27:10-11), drawn as 3 instanced meshes (60 posts, 3 draw calls) */}
      <Posts posts={posts} height={height} seg={seg} />
      {/* fine linen curtains, 5 cubits high (Êx 27:9-18) */}
      {side(-halfW)}{side(halfW)}
      <mesh position={[0, height / 2, -halfL]}><boxGeometry args={[halfW * 2, height * 0.92, 0.05]} /><Mat c={LINEN} r={0.95} /></mesh>
      <mesh position={[-(halfW + GATE.half) / 2, height / 2, halfL]}><boxGeometry args={[halfW - GATE.half, height * 0.92, 0.05]} /><Mat c={LINEN} r={0.95} /></mesh>
      <mesh position={[(halfW + GATE.half) / 2, height / 2, halfL]}><boxGeometry args={[halfW - GATE.half, height * 0.92, 0.05]} /><Mat c={LINEN} r={0.95} /></mesh>
      {/* the gate curtain, 20 cubits, drawn aside: blue, purple, crimson (Êx 27:16) */}
      <Stripes x={-(GATE.half + GATE.opening) / 2} y={height / 2} z={halfL} w={GATE.half - GATE.opening} h={height * 0.92} />
      <Stripes x={(GATE.half + GATE.opening) / 2} y={height / 2} z={halfL} w={GATE.half - GATE.opening} h={height * 0.92} />

      {/* the altar of burnt offering: acacia covered with bronze, 5 x 5 x 3 cubits, horns at the corners (Êx 27:1-8) */}
      <group position={[ALTAR.at[0], 0, ALTAR.at[1]]}>
        <mesh position={[0, ALTAR.height / 2, 0]}><boxGeometry args={[ALTAR.side, ALTAR.height, ALTAR.side]} /><Metal c={BRONZE} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (ALTAR.side / 2 - 0.08), ALTAR.height + 0.1, sz * (ALTAR.side / 2 - 0.08)]}><coneGeometry args={[0.09, 0.22, seg]} /><Metal c={BRONZE} /></mesh>)}
        <mesh position={[0, ALTAR.height + 0.2, 0]}><coneGeometry args={[0.45, detail === 2 ? 0.5 : 0.8, detail === 0 ? 10 : 5]} /><Mat c="#ffb347" e="#ff7a14" /></mesh>
        {detail < 2 && <pointLight position={[0, ALTAR.height + 1, 0]} intensity={6} distance={14} color="#ff9a3c" />}
      </group>

      {/* the laver of bronze: shape and size are a reconstruction (Êx 30:17-21; 38:8) */}
      <group position={[LAVER.at[0], 0, LAVER.at[1]]}>
        <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.28, 0.4, 0.9, seg + 4]} /><Metal c={BRONZE} /></mesh>
        <mesh position={[0, 1.0, 0]}><cylinderGeometry args={[0.7, 0.4, 0.28, seg + 6]} /><Metal c={BRONZE} /></mesh>
        <mesh position={[0, 1.13, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.62, seg + 6]} /><Mat c="#5aa3c9" r={0.1} m={0.2} /></mesh>
      </group>
    </group>
  );
}

export function TabernacleTent({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 12 : detail === 1 ? 8 : 5;
  const zc = tentCenterZ(), len = TENT.length, hw = TENT.halfW, h = TENT.height, west = tentWest();
  const boards = (x: number, n: number, zStart: number) => Array.from({ length: n }, (_, i) => <mesh key={`${x}${i}`} position={[x, h / 2, zStart - (i + 0.5) * TENT.board]}><boxGeometry args={[0.14, h, TENT.board * 0.94]} /><Metal c={GOLD} /></mesh>);
  const holyZ = (TENT.door + VEIL_Z()) / 2;
  return (
    <group>
      {/* floor of the tent: the ground inside is covered, schematic */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, zc]}><planeGeometry args={[hw * 2, len]} /><Mat c="#6b4a2e" r={1} /></mesh>
      {/* boards of acacia covered with gold: 20 per side, 6 at the back (Êx 26:15-25) */}
      {boards(-hw, 20, TENT.door)}{boards(hw, 20, TENT.door)}
      {Array.from({ length: 6 }, (_, i) => <mesh key={`w${i}`} position={[-hw + (i + 0.5) * ((hw * 2) / 6), h / 2, west]}><boxGeometry args={[(hw * 2) / 6 * 0.94, h, 0.14]} /><Metal c={GOLD} /></mesh>)}
      {/* outside: the coverings hang over the boards (goat hair, rams' skins dyed red, fine skins): a flat roof is a reconstruction */}
      {[[-hw - 0.12, GOAT], [hw + 0.12, GOAT]].map(([x, col], i) => <mesh key={`o${i}`} position={[x as number, h * 0.52, zc]}><boxGeometry args={[0.1, h * 1.04, len + 0.3]} /><Mat c={col as string} r={1} /></mesh>)}
      <mesh position={[0, h * 0.52, west - 0.12]}><boxGeometry args={[hw * 2 + 0.5, h * 1.04, 0.1]} /><Mat c={GOAT} r={1} /></mesh>
      <mesh position={[-hw - 0.22, h * 0.8, zc]}><boxGeometry args={[0.08, h * 0.5, len + 0.5]} /><Mat c={RAMS} r={1} /></mesh>
      <mesh position={[hw + 0.22, h * 0.8, zc]}><boxGeometry args={[0.08, h * 0.5, len + 0.5]} /><Mat c={RAMS} r={1} /></mesh>
      <mesh position={[0, h + 0.05, zc]}><boxGeometry args={[hw * 2 + 0.5, 0.06, len + 0.5]} /><Mat c={BLUE} r={0.95} /></mesh>
      <mesh position={[0, h + 0.12, zc]}><boxGeometry args={[hw * 2 + 0.6, 0.06, len + 0.7]} /><Mat c={GOAT} r={1} /></mesh>
      <mesh position={[0, h + 0.19, zc]}><boxGeometry args={[hw * 2 + 0.7, 0.06, len + 0.9]} /><Mat c={RAMS} r={1} /></mesh>
      <mesh position={[0, h + 0.26, zc]}><boxGeometry args={[hw * 2 + 0.8, 0.06, len + 1.1]} /><Mat c={TACHASH} r={0.5} /></mesh>

      {/* door: 5 pillars of acacia covered with gold on bases of bronze, curtain drawn aside (Êx 26:36-37) */}
      {DOOR_PILLARS.map((x) => <group key={x} position={[x, 0, TENT.door]}><mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.12, 0.14, 0.12, seg]} /><Metal c={BRONZE} /></mesh><mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.07, 0.07, h, seg]} /><Metal c={GOLD} /></mesh></group>)}
      <Stripes x={-1.55} y={h / 2} z={TENT.door} w={1.1} h={h * 0.98} />
      <Stripes x={1.55} y={h / 2} z={TENT.door} w={1.1} h={h * 0.98} />

      {/* the veil: 4 pillars on bases of silver, curtain drawn open so the Most Holy Place can be SEEN, never entered (Êx 26:31-33) */}
      {VEIL_PILLARS.map((x) => <group key={x} position={[x, 0, VEIL_Z()]}><mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.12, 0.14, 0.12, seg]} /><Metal c={SILVER} /></mesh><mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.07, 0.07, h, seg]} /><Metal c={GOLD} /></mesh></group>)}
      <Stripes x={-1.35} y={h / 2} z={VEIL_Z()} w={1.3} h={h * 0.98} />
      <Stripes x={1.35} y={h / 2} z={VEIL_Z()} w={1.3} h={h * 0.98} />

      {/* the table (north): acacia covered with pure gold, 2 x 1 x 1.5 cubits; the loaves: quantity not given in Êx 25-40 (Êx 25:23-30) */}
      <group position={[TABLE.at[0], 0, TABLE.at[1]]}>
        <mesh position={[0, TABLE.height - 0.03, 0]}><boxGeometry args={[TABLE.size[0], 0.06, TABLE.size[1]]} /><Metal c={GOLD} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (TABLE.size[0] / 2 - 0.03), TABLE.height / 2, sz * (TABLE.size[1] / 2 - 0.03)]}><boxGeometry args={[0.05, TABLE.height, 0.05]} /><Metal c={GOLD} /></mesh>)}
        {[0, 1].map((i) => <mesh key={i} position={[0, TABLE.height + 0.04 + i * 0.08, -0.2 + i * 0.4]}><boxGeometry args={[0.32, 0.07, 0.3]} /><Mat c="#c99a52" r={0.9} /></mesh>)}
      </group>

      {/* the lampstand (south): pure gold, 6 arms and 7 lamps (Êx 25:31-40); the height (1.5 m) and the curved arms are a reconstruction */}
      <group position={[LAMPSTAND.at[0], 0, LAMPSTAND.at[1]]}>
        <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.22, 0.28, 0.1, seg]} /><Metal c={GOLD} /></mesh>
        <mesh position={[0, LAMPSTAND.height / 2, 0]}><cylinderGeometry args={[0.035, 0.05, LAMPSTAND.height, seg]} /><Metal c={GOLD} /></mesh>
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => {
          const x = k * 0.17, top = LAMPSTAND.height + (k === 0 ? 0.04 : -Math.abs(k) * 0.015);
          return (
            <group key={k}>
              {k !== 0 && <mesh position={[x / 2, 0.75 + Math.abs(k) * 0.1, 0]} rotation={[0, 0, -Math.atan2(x, 0.8 + Math.abs(k) * 0.1) * 0.9]}><cylinderGeometry args={[0.018, 0.018, 0.8 + Math.abs(k) * 0.12, 5]} /><Metal c={GOLD} /></mesh>}
              <mesh position={[x, top, 0]}><cylinderGeometry args={[0.045, 0.03, 0.06, seg]} /><Metal c={GOLD} /></mesh>
              <mesh position={[x, top + 0.07, 0]}><coneGeometry args={[0.025, 0.07, 5]} /><Mat c="#ffd27a" e="#ffa63a" /></mesh>
            </group>
          );
        })}
        {detail < 2 && <pointLight position={[0, LAMPSTAND.height + 0.2, 0]} intensity={5} distance={9} color="#ffb85c" />}
      </group>

      {/* the altar of incense (before the veil): gold, 1 x 1 x 2 cubits, horns (Êx 30:1-10) */}
      <group position={[INCENSE.at[0], 0, INCENSE.at[1]]}>
        <mesh position={[0, INCENSE.height / 2, 0]}><boxGeometry args={[INCENSE.size, INCENSE.height, INCENSE.size]} /><Metal c={GOLD} /></mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (INCENSE.size / 2 - 0.03), INCENSE.height + 0.05, sz * (INCENSE.size / 2 - 0.03)]}><coneGeometry args={[0.04, 0.1, 5]} /><Metal c={GOLD} /></mesh>)}
        <mesh position={[0, INCENSE.height + 0.45, 0]}><coneGeometry args={[0.25, 0.7, 6]} /><meshStandardMaterial color="#e9e3d6" transparent opacity={0.35} /></mesh>
      </group>

      {/* the ark (seen beyond the veil): acacia covered with gold, 2.5 x 1.5 x 1.5 cubits, mercy seat and two abstract cherubim, no faces (Êx 25:10-22) */}
      <group position={[ARK.at[0], 0, ARK.at[1]]}>
        <mesh position={[0, ARK.height / 2, 0]}><boxGeometry args={[ARK.size[1], ARK.height, ARK.size[0]]} /><Metal c={GOLD} /></mesh>
        <mesh position={[0, ARK.height + 0.02, 0]}><boxGeometry args={[ARK.size[1] + 0.04, 0.04, ARK.size[0] + 0.04]} /><Metal c={GOLD} /></mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, ARK.height + 0.04, s * (ARK.size[0] / 2 - 0.14)]}>
            <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.1, 0.32, 0.1]} /><Metal c={GOLD} /></mesh>
            <mesh position={[-0.22, 0.34, -s * 0.07]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.46, 0.03, 0.2]} /><Metal c={GOLD} /></mesh>
            <mesh position={[0.22, 0.34, -s * 0.07]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.46, 0.03, 0.2]} /><Metal c={GOLD} /></mesh>
          </group>
        ))}
        {/* the presence is only light (RA-20) */}
        <mesh position={[0, ARK.height + 0.9, 0]}><sphereGeometry args={[0.55, 12, 8]} /><meshBasicMaterial color="#fff4cc" transparent opacity={0.22} /></mesh>
        <pointLight position={[0, ARK.height + 0.9, 0]} intensity={4} distance={8} color="#fff0c0" />
      </group>
      {detail < 2 && <pointLight position={[0, h * 0.7, holyZ]} intensity={1.6} distance={12} color="#ffe2a8" />}

      {/* the cloud over the tent (Êx 40:34-38): light and cloud, never a figure */}
      {[[0, 0], [2.2, 1.2], [-2.0, -1.0], [0.6, -2.4]].map(([dx, dz], i) => <mesh key={i} position={[dx, h + 3.2 + i * 0.3, zc + dz]}><sphereGeometry args={[1.8 + (i % 2) * 0.5, 12, 8]} /><meshStandardMaterial color="#f3efe6" transparent opacity={0.5} roughness={1} /></mesh>)}
    </group>
  );
}

export const TABERNACLE_SCENES: Record<string, (p: { detail: Detail }) => React.JSX.Element> = { tabernacle_court: TabernacleCourt, tabernacle_tent: TabernacleTent };
