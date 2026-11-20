"use client";

// The three scenes, built from boxes, cylinders and spheres. Units: 1 cubit = 0.5.
const GOLD = "#d4a72c", ACACIA = "#7a5230", STONE = "#d8cdb2", CEDAR = "#a9794b", BRONZE = "#a8672d", LINEN = "#f3ecd9", RED = "#9b3a2a", BLUE = "#3b5a7a";

const Box = ({ p, s, c, m = 0.1, r = 0.7 }: { p: [number, number, number]; s: [number, number, number]; c: string; m?: number; r?: number }) => (
  <mesh position={p}><boxGeometry args={s} /><meshStandardMaterial color={c} metalness={Math.min(m, 0.4)} roughness={r} emissive={c === GOLD ? "#7a5a00" : "#000000"} emissiveIntensity={c === GOLD ? 0.45 : 0} /></mesh>
);
const Cyl = ({ p, r, h, c, m = 0.1, rr = 0.7 }: { p: [number, number, number]; r: number; h: number; c: string; m?: number; rr?: number }) => (
  <mesh position={p}><cylinderGeometry args={[r, r, h, 24]} /><meshStandardMaterial color={c} metalness={Math.min(m, 0.4)} roughness={rr} emissive={c === GOLD ? "#7a5a00" : "#000000"} emissiveIntensity={c === GOLD ? 0.45 : 0} /></mesh>
);
const Ground = ({ size = 30 }: { size?: number }) => <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[size, size]} /><meshStandardMaterial color="#e3d6b6" roughness={1} /></mesh>;

function Cherub({ x }: { x: number }) {
  const dir = x < 0 ? 1 : -1; // faces the other
  return (
    <group position={[x, 1.15, 0]} rotation={[0, dir * 0.15, 0]}>
      <Box p={[0, 0, 0]} s={[0.22, 0.55, 0.22]} c={GOLD} m={0.9} r={0.25} />
      <mesh position={[0, 0.38, 0]}><sphereGeometry args={[0.14, 20, 20]} /><meshStandardMaterial color={GOLD} metalness={0.4} roughness={0.3} emissive="#7a5a00" emissiveIntensity={0.45} /></mesh>
      <Box p={[-dir * 0.0, 0.15, 0.32]} s={[0.05, 0.4, 0.5]} c={GOLD} m={0.9} r={0.25} />
      <Box p={[0, 0.15, -0.32]} s={[0.05, 0.4, 0.5]} c={GOLD} m={0.9} r={0.25} />
    </group>
  );
}

function Ark({ position = [0, 0, 0] as [number, number, number], scale = 1 }) {
  const L = 1.25, H = 0.75, W = 0.75; // 2.5 x 1.5 x 1.5 cubits
  return (
    <group position={position} scale={scale}>
      <Box p={[0, H / 2, 0]} s={[L * 2, H, W * 2]} c={ACACIA} r={0.8} />
      <Box p={[0, H / 2, 0]} s={[L * 2 + 0.04, H - 0.06, W * 2 + 0.04]} c={GOLD} m={0.95} r={0.22} />
      <Box p={[0, H + 0.04, 0]} s={[L * 2 + 0.1, 0.08, W * 2 + 0.1]} c={GOLD} m={0.95} r={0.2} />
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => <mesh key={`${a}${b}`} position={[a * (L - 0.05), 0.12, b * (W + 0.03)]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.025, 10, 18]} /><meshStandardMaterial color={GOLD} metalness={0.4} roughness={0.3} emissive="#7a5a00" emissiveIntensity={0.45} /></mesh>)}
      {[-1, 1].map((b) => <mesh key={b} position={[0, 0.12, b * (W + 0.03)]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, L * 2 + 1.1, 12]} /><meshStandardMaterial color={ACACIA} roughness={0.8} /></mesh>)}
      <Cherub x={-0.55} /><Cherub x={0.55} />
    </group>
  );
}

export function ArkScene() {
  return <><Ground size={14} /><Ark /></>;
}

function Court() {
  const w = 5, d = 10; // 50 x 100 cubits -> 25 x 50 would be big: reduced scale 0.1/cubit for the court
  const posts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { posts.push([-w / 2, -d / 2 + i * (d / 10)]); posts.push([w / 2, -d / 2 + i * (d / 10)]); }
  for (let i = 1; i < 5; i++) { posts.push([-w / 2 + i * (w / 5), -d / 2]); posts.push([-w / 2 + i * (w / 5), d / 2]); }
  return (
    <group>
      {posts.map(([x, z], i) => <Cyl key={i} p={[x, 0.45, z]} r={0.04} h={0.9} c={BRONZE} />)}
      <Box p={[-w / 2, 0.45, 0]} s={[0.03, 0.8, d]} c={LINEN} r={0.95} />
      <Box p={[w / 2, 0.45, 0]} s={[0.03, 0.8, d]} c={LINEN} r={0.95} />
      <Box p={[0, 0.45, -d / 2]} s={[w, 0.8, 0.03]} c={LINEN} r={0.95} />
      <Box p={[-w / 4 - 0.6, 0.45, d / 2]} s={[w / 2 - 1.2, 0.8, 0.03]} c={LINEN} r={0.95} />
      <Box p={[w / 4 + 0.6, 0.45, d / 2]} s={[w / 2 - 1.2, 0.8, 0.03]} c={LINEN} r={0.95} />
      <Box p={[0, 0.45, d / 2]} s={[1.2, 0.8, 0.03]} c={BLUE} r={0.95} />
    </group>
  );
}

export function TabernacleScene() {
  return (
    <>
      <Ground />
      <group scale={1.4}>
        <Court />
        <Box p={[0, 0.3, 2.9]} s={[0.9, 0.6, 0.9]} c={BRONZE} m={0.5} r={0.5} />{/* bronze altar */}
        <Cyl p={[0, 0.25, 1.1]} r={0.35} h={0.5} c={BRONZE} m={0.5} rr={0.4} />{/* laver */}
        <group position={[0, 0, -1.6]}>{/* tent 30 x 10 x 10 cubits */}
          <Box p={[0, 0.75, 0]} s={[1.6, 1.5, 4.6]} c={CEDAR} r={0.9} />
          <Box p={[0, 1.52, 0]} s={[1.75, 0.06, 4.75]} c={RED} r={0.95} />
          <Box p={[0, 0.75, -0.75]} s={[1.62, 1.4, 0.04]} c={BLUE} r={0.9} />{/* veil */}
        </group>
        <Box p={[0.35, 0.4, -0.2]} s={[0.4, 0.05, 0.25]} c={GOLD} m={0.9} r={0.3} /> {/* table */}
        <Cyl p={[-0.35, 0.4, -0.2]} r={0.05} h={0.7} c={GOLD} m={0.9} rr={0.3} /> {/* lampstand */}
        <Box p={[0, 0.35, -0.7]} s={[0.25, 0.5, 0.25]} c={GOLD} m={0.9} r={0.3} /> {/* incense altar */}
        <Ark position={[0, 0.02, -1.55]} scale={0.22} />
      </group>
    </>
  );
}

export function TempleScene() {
  return (
    <>
      <Ground size={40} />
      {/* platform and building: 60 x 20 x 30 cubits, 1 cubit = 0.25 here */}
      <Box p={[0, 0.2, 0]} s={[9, 0.4, 7]} c={STONE} r={0.9} />
      <Box p={[0, 2.2, 0]} s={[3.2, 3.6, 8]} c={STONE} r={0.9} />
      <Box p={[0, 4.05, 0]} s={[3.3, 0.18, 8.1]} c={CEDAR} r={0.9} />
      <Box p={[0, 1.2, 4.1]} s={[3.2, 1.6, 2.2]} c={STONE} r={0.9} />{/* porch */}
      <Box p={[0, 2.5, 4.1]} s={[3.3, 1.2, 2.3]} c={CEDAR} r={0.9} />
      <Box p={[0, 1.7, -2.8]} s={[2.9, 2.4, 2.4]} c={GOLD} m={0.8} r={0.35} />{/* debir, gold-lined */}
      {[-2.15, 2.15].map((x) => [-2.2, 0, 2.2].map((z) => <Box key={`${x}${z}`} p={[x, 1.1, z]} s={[1.0, 1.8, 1.7]} c={STONE} r={0.9} />))}{/* side chambers */}
      {[-0.95, 0.95].map((x) => <group key={x}><Cyl p={[x, 1.9, 5.5]} r={0.18} h={3.8} c={BRONZE} m={0.5} rr={0.45} /><mesh position={[x, 3.9, 5.5]}><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color={BRONZE} metalness={0.3} roughness={0.5} /></mesh></group>)}{/* Jachin and Boaz */}
      <Cyl p={[-3.4, 0.9, 4.0]} r={0.9} h={0.7} c={BRONZE} m={0.5} rr={0.45} />{/* sea */}
      {[0, 1, 2, 3].map((i) => <Box key={i} p={[-4.1 + (i % 2) * 1.4, 0.3, 3.4 + Math.floor(i / 2) * 1.2]} s={[0.4, 0.45, 0.7]} c={BRONZE} m={0.5} r={0.5} />)}
      <Box p={[0, 0.35, 8]} s={[7, 0.5, 4]} c={STONE} r={0.9} />{/* court */}
    </>
  );
}
