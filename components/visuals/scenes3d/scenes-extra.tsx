"use client";

// Twelve more scenes (spec 8.18). Same building blocks as scenes.tsx: boxes, cylinders, curved tubes and procedural textures.
// Schematic reconstructions; no figure of Jesus or of God the Father is ever drawn (RA-20).
import { useMemo } from "react";
import { DoubleSide } from "three";
import { BRONZE, CEDAR, Bronze, Gold, Ground, Linen, Stone, Studio, Tube, Wood } from "./scenes";

export type V3 = [number, number, number];
export const SAND = "#cdb48a", WATER = "#4f86a3", SEA = "#3d7a93", GRASS = "#8aa46a", CLAY = "#b98a5a", DARK = "#4a3a2a";
export const Mat = ({ c, r = 0.9, m = 0 }: { c: string; r?: number; m?: number }) => <meshStandardMaterial color={c} roughness={r} metalness={m} side={DoubleSide} />;
export const Box = ({ p, s, c = CLAY, stone = false, wood = false }: { p: V3; s: V3; c?: string; stone?: boolean; wood?: boolean }) => (
  <mesh position={p}><boxGeometry args={s} />{stone ? <Stone repeat={[Math.max(1, Math.round(s[0])), Math.max(1, Math.round(s[1]))]} /> : wood ? <Wood base={c} repeat={[2, 1]} /> : <Mat c={c} />}</mesh>
);
export const Cyl = ({ p, r, h, c = CLAY, seg = 24, rt, m = 0 }: { p: V3; r: number; h: number; c?: string; seg?: number; rt?: number; m?: number }) => (
  <mesh position={p}><cylinderGeometry args={[rt ?? r, r, h, seg]} /><Mat c={c} m={m} /></mesh>
);

// ---------- 1. Menorah ----------
export function MenorahScene() {
  const branches = [-3, -2, -1, 1, 2, 3];
  return (
    <>
      <Studio />
      <Ground size={20} />
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.9, 1.05, 0.24, 32]} /><Gold /></mesh>
      <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[0.07, 0.1, 2.9, 20]} /><Gold /></mesh>
      {[0.6, 1.2, 1.8].map((y) => <mesh key={y} position={[0, y, 0]}><sphereGeometry args={[0.17, 16, 16]} /><Gold /></mesh>)}
      {branches.map((k) => {
        const side = Math.sign(k), n = Math.abs(k), top = 1.9 + (n === 1 ? 0.5 : n === 2 ? 0.9 : 1.25);
        const w = n * 0.62;
        return (
          <group key={k}>
            <Tube points={[[0, 0.75 + n * 0.1, 0], [side * w * 0.9, 0.75 + n * 0.1, 0], [side * w, top - 1.0, 0], [side * w, top - 0.2, 0]]} r={0.055}><Gold /></Tube>
            <mesh position={[side * w, top - 0.55, 0]}><sphereGeometry args={[0.13, 14, 14]} /><Gold /></mesh>
            <mesh position={[side * w, top, 0]}><cylinderGeometry args={[0.16, 0.09, 0.2, 16]} /><Gold /></mesh>
            <mesh position={[side * w, top + 0.18, 0]}><coneGeometry args={[0.06, 0.22, 10]} /><meshStandardMaterial color="#ffd36a" emissive="#ff9a1f" emissiveIntensity={1.6} /></mesh>
          </group>
        );
      })}
      <mesh position={[0, 2.95, 0]}><cylinderGeometry args={[0.16, 0.09, 0.2, 16]} /><Gold /></mesh>
      <mesh position={[0, 3.13, 0]}><coneGeometry args={[0.06, 0.22, 10]} /><meshStandardMaterial color="#ffd36a" emissive="#ff9a1f" emissiveIntensity={1.6} /></mesh>
    </>
  );
}

// ---------- 2. Noah's Ark ----------
export function NoahArkScene() {
  const hull = useMemo(() => ({ l: 12, w: 2.4, h: 1.6 }), []);
  return (
    <>
      <Studio />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[60, 60]} /><Mat c="#8f8a78" /></mesh>
      {/* mountain slope under the bow */}
      <mesh position={[6.2, 0.4, -1]} rotation={[0, 0, 0]}><coneGeometry args={[3.2, 2.4, 6]} /><Stone repeat={[3, 2]} /></mesh>
      {[0, 1, 2].map((d) => (
        <mesh key={d} position={[0, 0.6 + d * hull.h * 0.62, 0]}><boxGeometry args={[hull.l, hull.h * 0.62, hull.w]} /><Wood base={d === 1 ? "#6d4a2a" : "#7a5230"} repeat={[6, 1]} /></mesh>
      ))}
      <mesh position={[0, 2.95, 0]}><boxGeometry args={[hull.l + 0.4, 0.14, hull.w + 0.4]} /><Wood base="#5a3d22" repeat={[6, 1]} /></mesh>
      <mesh position={[0, 3.2, 0]} rotation={[0, 0, 0]}><boxGeometry args={[hull.l * 0.9, 0.5, hull.w * 0.55]} /><Wood base="#5a3d22" repeat={[5, 1]} /></mesh>
      <Box p={[3, 1.2, hull.w / 2 + 0.03]} s={[0.9, 1.4, 0.08]} c="#3d2a18" wood />{/* door in the side */}
      <Box p={[-1, 3.45, 0.55]} s={[1.4, 0.12, 0.5]} c="#2a1c10" />{/* opening near the roof */}
    </>
  );
}

// ---------- 3. Tower of Babel ----------
export function BabelScene() {
  const levels = [{ s: 7, y: 0.6 }, { s: 5.8, y: 1.8 }, { s: 4.6, y: 3.0 }, { s: 3.4, y: 4.2 }, { s: 2.2, y: 5.4 }];
  return (
    <>
      <Studio />
      <Ground size={50} />
      {levels.map((l, i) => <Box key={i} p={[0, l.y, 0]} s={[l.s, 1.2, l.s]} c={i % 2 ? "#a8754a" : "#b98255"} />)}
      <Box p={[0, 6.4, 0]} s={[1.2, 0.8, 1.2]} c="#2f5d8a" />{/* small temple of blue glazed bricks */}
      {/* processional stair: a landing in front of each level, going up the front face */}
      {levels.map((l, i) => <group key={`st${i}`}><Box p={[0, l.y - 0.35, l.s / 2 + 0.55]} s={[1.3, 0.5, 1.1]} c="#8c5f38" /><Box p={[0, l.y - 0.62, l.s / 2 + 1.35]} s={[1.3, 0.3, 0.7]} c="#8c5f38" /></group>)}
      {[[-5, -1], [-6, 2], [5, 1], [6, -2], [4, -5], [-4, -5]].map(([x, z], i) => (
        <group key={i}><Box p={[x, 0.45, z]} s={[1.6, 0.9, 1.4]} c="#c9a878" /><Box p={[x, 1.0, z]} s={[1.7, 0.16, 1.5]} c="#a98a5e" /></group>
      ))}
    </>
  );
}

// ---------- 4. Walls of Jericho ----------
export function JerichoScene() {
  return (
    <>
      <Studio />
      <Ground size={60} />
      <mesh position={[0, 0.8, -2.6]}><boxGeometry args={[14, 1.6, 2.2]} /><Stone repeat={[8, 1]} /></mesh>{/* retaining wall (stone) */}
      <mesh position={[0, 2.6, -2.6]}><boxGeometry args={[11, 2.6, 1.4]} /><Mat c="#c4a273" /></mesh>{/* city wall (mud brick) */}
      <mesh position={[0, 1.6, -0.3]} rotation={[0.5, 0, 0]}><boxGeometry args={[11, 0.4, 3]} /><Stone repeat={[8, 1]} /></mesh>{/* glacis slope */}
      {[-5.2, 5.2].map((x) => <group key={x}><Box p={[x, 3.4, -2.6]} s={[1.6, 4.2, 1.8]} c="#b8946a" /><Box p={[x, 5.6, -2.6]} s={[1.9, 0.3, 2.1]} c="#a07c52" /></group>)}
      <Box p={[0, 1.9, -1.8]} s={[1.5, 2.4, 0.3]} c="#3d2a18" wood />{/* gate */}
      <Box p={[-3.6, 3.0, -1.8]} s={[0.9, 0.9, 0.25]} c="#8a2f22" />{/* Rahab's house, red cord */}
      {/* seven priests with trumpets, and the ark behind */}
      {Array.from({ length: 7 }).map((_, i) => (
        <group key={i} position={[-3.6 + i * 1.2, 0, 5.2]}>
          <Cyl p={[0, 0.7, 0]} r={0.24} h={1.4} c="#f2ede0" seg={14} />
          <mesh position={[0, 1.6, 0]}><sphereGeometry args={[0.2, 14, 14]} /><Mat c="#caa27a" /></mesh>
          <mesh position={[0.28, 1.5, 0.2]} rotation={[0, 0.5, 1.1]}><coneGeometry args={[0.1, 0.9, 10]} /><Mat c="#cdb27a" /></mesh>
        </group>
      ))}
      <group position={[0, 0.5, 7.4]}><Box p={[0, 0.2, 0]} s={[1.0, 0.6, 0.6]} c="#d8aa3a" /></group>
    </>
  );
}

// ---------- 5. Four-room house ----------
export function FourRoomHouseScene() {
  return (
    <>
      <Studio />
      <Ground size={30} />
      <Box p={[0, 0.1, 0]} s={[8.6, 0.2, 7.6]} c="#a38a62" />
      {/* outer walls (stone), with the courtyard open in front */}
      <Box p={[0, 1.2, -3.4]} s={[8, 2.2, 0.4]} stone />
      <Box p={[-3.8, 1.2, -0.4]} s={[0.4, 2.2, 6.2]} stone />
      <Box p={[3.8, 1.2, -0.4]} s={[0.4, 2.2, 6.2]} stone />
      {/* the long room at the back and two rooms on the sides, divided by pillars */}
      <Box p={[0, 1.2, -1.6]} s={[8, 2.2, 0.25]} c="#c8ab7c" />
      {[-1.4, 1.4].map((x) => <Box key={x} p={[x, 1.0, 0.8]} s={[0.25, 1.8, 3.6]} c="#c8ab7c" />)}
      {[-2.9, -1.0, 1.0, 2.9].map((x) => <Cyl key={x} p={[x, 1.0, -0.4]} r={0.16} h={2.0} c="#8a6c46" seg={12} />)}
      <Box p={[0, 2.38, -0.6]} s={[8.2, 0.24, 6]} c="#7a5230" wood />{/* flat roof */}
      <Box p={[0, 2.75, -3.4]} s={[8.2, 0.5, 0.18]} c="#c8ab7c" />{/* parapet */}
      <Box p={[-3.8, 2.75, -0.6]} s={[0.18, 0.5, 6]} c="#c8ab7c" />
      <Box p={[3.8, 2.75, -0.6]} s={[0.18, 0.5, 6]} c="#c8ab7c" />
      <Box p={[0, 2.75, 2.4]} s={[8.2, 0.5, 0.18]} c="#c8ab7c" />
      {/* outside stairs */}
      {[0, 1, 2, 3, 4].map((i) => <Box key={i} p={[4.4, 0.25 + i * 0.5, 1.8 - i * 0.55]} s={[0.9, 0.5, 0.55]} stone />)}
      {/* oven in the courtyard */}
      <Cyl p={[-2.4, 0.5, 2.8]} r={0.55} rt={0.35} h={0.9} c="#9a6a40" seg={16} />
    </>
  );
}

// ---------- 6. Jerusalem in the time of Jesus ----------
export function JerusalemScene() {
  return (
    <>
      <Studio />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[80, 80]} /><Mat c="#cdbb92" /></mesh>
      {/* Kidron valley (a dark strip) and the Mount of Olives */}
      <Box p={[8.4, 0.02, 0]} s={[1.6, 0.06, 18]} c="#7b6a4e" />
      <mesh position={[13, 1.2, 1]}><coneGeometry args={[6, 3.2, 6]} /><Mat c={GRASS} /></mesh>
      {/* the city on its hills (terraced) */}
      <Box p={[-3, 0.5, 0]} s={[10, 1.0, 14]} c="#c9b184" />
      <Box p={[-4, 1.3, 1]} s={[7, 0.8, 10]} c="#d4bd90" />
      {Array.from({ length: 26 }).map((_, i) => <Box key={i} p={[-7 + (i % 6) * 1.5, 1.9, -4 + Math.floor(i / 6) * 2.2]} s={[1.1, 0.5, 1.1]} c="#e3d3ab" />)}
      {/* city walls */}
      <Box p={[-3, 0.9, 7.1]} s={[10.4, 1.4, 0.3]} stone />
      <Box p={[-8.1, 0.9, 0]} s={[0.3, 1.4, 14]} stone />
      {/* Temple Mount platform */}
      <Box p={[3.4, 1.2, -0.4]} s={[7, 2.4, 9]} stone />
      <Box p={[3.4, 2.5, -0.4]} s={[6.6, 0.2, 8.6]} c="#e9ddbf" />
      <Box p={[3.4, 3.3, -0.4]} s={[2.2, 1.6, 3.6]} c="#f0e4c2" />{/* the sanctuary */}
      <Box p={[3.4, 4.15, -0.4]} s={[2.4, 0.16, 3.8]} c="#d9aa2c" />
      <Box p={[3.4, 3.2, 1.9]} s={[5.6, 0.9, 0.3]} c="#efe3c3" />{/* southern portico */}
      {/* Antonia fortress at the north-west corner */}
      <Box p={[1.4, 3.0, -4.6]} s={[1.8, 3.2, 1.8]} stone />
      {/* pools */}
      <mesh position={[-0.6, 0.06, -4.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.6, 1.2]} /><Mat c={WATER} r={0.1} /></mesh>
      <mesh position={[-1.4, 0.06, 7.6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.8, 1.2]} /><Mat c={WATER} r={0.1} /></mesh>
    </>
  );
}

// ---------- 7. Paul's ship ----------
export function PaulShipScene() {
  return (
    <>
      <Studio />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[60, 60]} /><Mat c={SEA} r={0.15} m={0.1} /></mesh>
      {/* hull: lower box and curved upper strakes */}
      <mesh position={[0, 0.7, 0]}><boxGeometry args={[7.6, 1.2, 2.2]} /><Wood base="#6b4526" repeat={[7, 1]} /></mesh>
      <mesh position={[3.9, 1.0, 0]} rotation={[0, 0, 0.55]}><boxGeometry args={[1.4, 0.8, 1.7]} /><Wood base="#6b4526" repeat={[2, 1]} /></mesh>{/* bow */}
      <mesh position={[-4.0, 1.5, 0]} rotation={[0, 0, -0.9]}><boxGeometry args={[1.8, 0.7, 1.6]} /><Wood base="#6b4526" repeat={[2, 1]} /></mesh>{/* high stern */}
      <mesh position={[0, 1.4, 0]}><boxGeometry args={[7.2, 0.14, 2.0]} /><Wood base="#8a6238" repeat={[6, 1]} /></mesh>{/* deck */}
      <Box p={[-2.6, 1.9, 0]} s={[1.6, 0.9, 1.4]} c="#7a5230" wood />{/* cabin */}
      <Cyl p={[0.6, 3.4, 0]} r={0.12} h={4.4} c="#6b4a2a" seg={10} />{/* mast */}
      <mesh position={[0.6, 4.1, 0.05]}><boxGeometry args={[0.06, 2.6, 4.2]} /><Linen repeat={[3, 3]} color="#f2e8cf" /></mesh>{/* square sail, furled partly */}
      <Cyl p={[0.6, 5.35, 0]} r={0.07} h={4.6} c="#6b4a2a" seg={8} />
      <mesh position={[0.6, 5.35, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 4.6, 8]} /><Mat c="#6b4a2a" /></mesh>
      {/* steering oars on the quarters */}
      {[-1, 1].map((s) => <mesh key={s} position={[-3.9, 1.0, s * 1.35]} rotation={[0.25 * s, 0, 0.45]}><boxGeometry args={[0.18, 2.6, 0.5]} /><Wood base="#5a3d22" repeat={[1, 1]} /></mesh>)}
      {/* anchors hanging from the stern */}
      {[-0.6, 0.6, -1.0, 1.0].map((z, i) => <group key={i} position={[-4.4, 0.7 - i * 0.05, z]}><Cyl p={[0, 0, 0]} r={0.05} h={1.1} c="#2b2b2b" seg={8} /><mesh position={[0, -0.6, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.26, 0.04, 8, 14, Math.PI]} /><Mat c="#2b2b2b" /></mesh></group>)}
      {/* grain sacks */}
      {[[1.8, 1.6, 0.5], [2.4, 1.6, -0.4], [1.2, 1.6, -0.5], [2.0, 1.95, 0]].map((p, i) => <mesh key={i} position={p as V3}><sphereGeometry args={[0.32, 10, 10]} /><Mat c="#d9c79a" /></mesh>)}
    </>
  );
}

// ---------- 8. Empty tomb ----------
export function EmptyTombScene() {
  return (
    <>
      <Studio />
      <Ground size={30} />
      {/* rock face with the tomb cut into it */}
      <mesh position={[0, 1.8, -1.6]}><boxGeometry args={[7.6, 3.6, 3.2]} /><Stone repeat={[5, 3]} /></mesh>
      <mesh position={[0, 0.9, 0.1]}><boxGeometry args={[1.8, 1.8, 0.4]} /><meshStandardMaterial color="#2b2118" roughness={1} /></mesh>{/* the dark entrance */}
      <mesh position={[0.2, 0.45, -1.2]}><boxGeometry args={[1.6, 0.5, 1.6]} /><Stone repeat={[2, 1]} /></mesh>{/* stone bench inside (visible through the opening) */}
      {/* grooved track and the round stone rolled aside */}
      <mesh position={[-1.1, 0.12, 0.7]}><boxGeometry args={[4.0, 0.12, 0.4]} /><Mat c="#6e6a60" /></mesh>
      <mesh position={[-2.3, 0.95, 0.65]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.95, 0.95, 0.4, 36]} /><Stone repeat={[2, 2]} /></mesh>
      {/* linen cloths on the bench */}
      <mesh position={[0.2, 0.74, -1.2]}><boxGeometry args={[1.1, 0.08, 0.55]} /><Linen repeat={[3, 2]} color="#f6f1e4" /></mesh>
      <mesh position={[1.0, 0.74, -1.0]} rotation={[0, 0.4, 0]}><boxGeometry args={[0.35, 0.1, 0.3]} /><Linen repeat={[1, 1]} color="#f1ead9" /></mesh>
      {/* garden: olive-like trees */}
      {[[3.4, 1.8], [4.6, 0.6], [-4.8, 2.4], [-3.4, 3.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}><Cyl p={[0, 0.7, 0]} r={0.16} h={1.4} c="#5a4630" seg={8} /><mesh position={[0, 1.8, 0]}><sphereGeometry args={[0.9, 14, 14]} /><Mat c="#6f8b52" /></mesh></group>
      ))}
    </>
  );
}

// ---------- 9. Solomon's throne ----------
export function ThroneScene() {
  const lion = (p: V3, s = 1) => (
    <group position={p} scale={s}>
      <mesh position={[0, 0.28, 0]}><boxGeometry args={[0.7, 0.42, 0.34]} /><Gold /></mesh>
      <mesh position={[0.4, 0.42, 0]}><sphereGeometry args={[0.2, 14, 14]} /><Gold /></mesh>
      <mesh position={[0.52, 0.34, 0]}><boxGeometry args={[0.16, 0.12, 0.16]} /><Gold /></mesh>
      {[-0.22, 0.22].map((x) => [-0.1, 0.1].map((z) => <mesh key={`${x}${z}`} position={[x, 0.07, z]}><boxGeometry args={[0.1, 0.16, 0.1]} /><Gold /></mesh>))}
    </group>
  );
  return (
    <>
      <Studio />
      <Ground size={20} />
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[4.4, 0.2, 4.4]} /><Mat c="#8a2f3a" /></mesh>{/* carpet */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i}>
          <mesh position={[0, 0.3 + i * 0.28, 1.6 - i * 0.3]}><boxGeometry args={[2.8 - i * 0.12, 0.28, 0.5]} /><meshStandardMaterial color="#efe6d0" roughness={0.45} /></mesh>
        </group>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => <group key={`l${i}`}>{lion([-1.3, 0.5 + i * 0.28, 1.6 - i * 0.3], 0.45)}{lion([1.05, 0.5 + i * 0.28, 1.6 - i * 0.3], 0.45)}</group>)}
      <mesh position={[0, 2.1, -0.2]}><boxGeometry args={[1.9, 0.5, 1.5]} /><meshStandardMaterial color="#f0e6cc" roughness={0.4} /></mesh>{/* seat (ivory) */}
      <mesh position={[0, 1.6, -0.2]}><boxGeometry args={[2.0, 0.5, 1.6]} /><Gold /></mesh>
      <mesh position={[0, 3.0, -0.8]}><cylinderGeometry args={[1.05, 1.05, 0.3, 28, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#f0e6cc" roughness={0.4} side={DoubleSide} /></mesh>{/* rounded back */}
      <mesh position={[0, 2.6, -0.85]}><boxGeometry args={[2.1, 1.2, 0.2]} /><meshStandardMaterial color="#f0e6cc" roughness={0.4} /></mesh>
      {[-1.1, 1.1].map((x) => <group key={x}><mesh position={[x, 2.45, -0.1]}><boxGeometry args={[0.16, 0.5, 1.5]} /><Gold /></mesh>{lion([x - 0.2, 2.5, 0.2], 0.55)}</group>)}
    </>
  );
}

// ---------- 10. Pool of Bethesda ----------
export function BethesdaScene() {
  const col = (x: number, z: number) => <Cyl key={`${x}_${z}`} p={[x, 1.2, z]} r={0.22} h={2.4} c="#e2d4b2" seg={14} />;
  const xs = [-5, -3, -1, 1, 3, 5];
  return (
    <>
      <Studio />
      <Ground size={40} />
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[12.4, 0.2, 7]} /><Stone repeat={[8, 3]} /></mesh>
      {/* two water basins with a wall between them */}
      <mesh position={[-2.8, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5, 4.6]} /><Mat c={WATER} r={0.1} /></mesh>
      <mesh position={[2.8, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5, 4.6]} /><Mat c={WATER} r={0.1} /></mesh>
      <Box p={[0, 1.2, 0]} s={[0.6, 2.4, 4.8]} stone />
      {/* four colonnades around, a fifth on the dividing wall */}
      {xs.map((x) => col(x, -3.1))}{xs.map((x) => col(x, 3.1))}
      {[-1.5, 1.5].map((z) => col(-5.9, z))}{[-1.5, 1.5].map((z) => col(5.9, z))}
      {[-1.6, 1.6].map((z) => col(0, z))}
      <Box p={[0, 2.5, -3.1]} s={[12.4, 0.25, 1.2]} c="#cdb88e" />
      <Box p={[0, 2.5, 3.1]} s={[12.4, 0.25, 1.2]} c="#cdb88e" />
      <Box p={[-5.9, 2.5, 0]} s={[1.2, 0.25, 6.2]} c="#cdb88e" />
      <Box p={[5.9, 2.5, 0]} s={[1.2, 0.25, 6.2]} c="#cdb88e" />
      <Box p={[0, 2.5, 0]} s={[1.0, 0.25, 4.8]} c="#cdb88e" />
      {/* steps */}
      {[0, 1, 2].map((i) => <Box key={i} p={[4.5, 0.18, 1.9 - i * 0.4]} s={[1.6, 0.06, 0.4]} stone />)}
      {/* sheep gate */}
      <Box p={[0, 1.4, -4.4]} s={[2.4, 2.8, 0.5]} stone />
      <Box p={[0, 1.0, -4.1]} s={[1.2, 2.0, 0.2]} c="#3d2a18" wood />
    </>
  );
}

// ---------- 11. Galilee boat ----------
export function GalileeBoatScene() {
  return (
    <>
      <Studio />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[40, 40]} /><Mat c={WATER} r={0.12} m={0.1} /></mesh>
      {/* hull as stacked planks narrowing toward both ends */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh position={[0, 0.25 + i * 0.22, 0]}><boxGeometry args={[4.4 - i * 0.18, 0.2, 1.5 - i * 0.0 + i * 0.12]} /><Wood base={i % 2 ? "#6e4a2a" : "#7e5a36"} repeat={[5, 1]} /></mesh>
        </group>
      ))}
      <mesh position={[2.35, 0.7, 0]} rotation={[0, 0, 0.7]}><boxGeometry args={[0.8, 0.14, 1.0]} /><Wood base="#6e4a2a" repeat={[1, 1]} /></mesh>
      <mesh position={[-2.35, 0.75, 0]} rotation={[0, 0, -0.7]}><boxGeometry args={[0.8, 0.14, 1.0]} /><Wood base="#6e4a2a" repeat={[1, 1]} /></mesh>
      <Box p={[-1.8, 0.5, 0]} s={[1.0, 0.4, 1.3]} c="#7a5230" wood />{/* stern deck */}
      <mesh position={[-1.8, 0.78, 0]}><boxGeometry args={[0.7, 0.16, 0.9]} /><Mat c="#8a2f3a" /></mesh>{/* cushion */}
      <Cyl p={[0.5, 1.9, 0]} r={0.07} h={2.8} c="#6b4a2a" seg={8} />{/* mast */}
      <mesh position={[0.5, 2.4, 0.05]}><boxGeometry args={[0.04, 1.4, 2.2]} /><Linen repeat={[2, 2]} color="#efe6cf" /></mesh>
      {[-0.4, 0.5].map((x) => [-1, 1].map((s) => <mesh key={`${x}${s}`} position={[x, 0.95, s * 0.95]} rotation={[0.9 * s, 0, 0.2]}><boxGeometry args={[0.05, 2.0, 0.14]} /><Wood base="#5a3d22" repeat={[1, 1]} /></mesh>))}
      {/* nets: a folded heap */}
      <mesh position={[1.4, 0.7, -0.3]}><sphereGeometry args={[0.5, 12, 10]} /><meshStandardMaterial color="#b9a77d" roughness={1} wireframe /></mesh>
      <mesh position={[1.4, 0.68, -0.3]}><sphereGeometry args={[0.46, 12, 10]} /><meshStandardMaterial color="#8d7c58" roughness={1} /></mesh>
    </>
  );
}

// ---------- 12. First-century synagogue ----------
export function SynagogueScene() {
  const cols = [-2.4, 0, 2.4];
  return (
    <>
      <Studio />
      <Ground size={30} />
      <Box p={[0, 0.1, 0]} s={[9.4, 0.2, 7.4]} c="#cdbb92" />
      {/* mosaic floor */}
      <mesh position={[0, 0.22, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.6, 4.4]} /><meshStandardMaterial color="#b9825a" roughness={0.7} /></mesh>
      <mesh position={[0, 0.23, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.4, 1.6, 4, 1, Math.PI / 4]} /><meshStandardMaterial color="#2f5d8a" roughness={0.7} /></mesh>
      {/* walls (three sides, front open) */}
      <Box p={[0, 1.6, -3.5]} s={[9, 3.2, 0.4]} stone />
      <Box p={[-4.5, 1.6, 0]} s={[0.4, 3.2, 7]} stone />
      <Box p={[4.5, 1.6, 0]} s={[0.4, 3.2, 7]} stone />
      {/* stone benches along the walls */}
      <Box p={[0, 0.5, -3.0]} s={[8.2, 0.5, 0.6]} stone />
      <Box p={[-4.0, 0.5, 0]} s={[0.6, 0.5, 6.2]} stone />
      <Box p={[4.0, 0.5, 0]} s={[0.6, 0.5, 6.2]} stone />
      <Box p={[-4.0, 0.95, 0]} s={[0.6, 0.4, 6.2]} stone />
      <Box p={[4.0, 0.95, 0]} s={[0.6, 0.4, 6.2]} stone />
      {/* columns and wooden roof */}
      {cols.map((x) => [-1.6, 1.8].map((z) => <Cyl key={`${x}${z}`} p={[x, 1.6, z]} r={0.26} h={3.2} c="#e4d6b4" seg={14} />))}
      {/* the roof is drawn as beams only, so the hall stays visible */}
      {[-3, -1, 1, 3].map((z) => <Box key={z} p={[0, 3.3, z]} s={[9.2, 0.22, 0.22]} c="#7a5230" wood />)}
      {[-4.4, 4.4].map((x) => <Box key={x} p={[x, 3.3, 0]} s={[0.22, 0.22, 7.2]} c="#7a5230" wood />)}
      {/* the Magdala stone, with a menorah */}
      <Box p={[0, 0.45, 0.2]} s={[1.1, 0.5, 0.8]} stone />
      <mesh position={[0, 0.72, 0.2]}><boxGeometry args={[0.5, 0.04, 0.04]} /><Gold /></mesh>
      <mesh position={[0, 0.8, 0.2]}><boxGeometry args={[0.04, 0.2, 0.04]} /><Gold /></mesh>
      {/* the reading stand with the scroll */}
      <Box p={[0, 0.7, -2.4]} s={[0.9, 0.9, 0.6]} c="#7a5230" wood />
      <mesh position={[0, 1.22, -2.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.7, 14]} /><Mat c="#efe6cf" /></mesh>
      <mesh position={[0, 1.22, -2.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 0.8, 8]} /><Bronze /></mesh>
    </>
  );
}

export const EXTRA_SCENES: Record<string, () => React.JSX.Element> = {
  menorah: MenorahScene,
  noah_ark: NoahArkScene,
  babel_tower: BabelScene,
  jericho_walls: JerichoScene,
  four_room_house: FourRoomHouseScene,
  jerusalem_herod: JerusalemScene,
  paul_ship: PaulShipScene,
  empty_tomb: EmptyTombScene,
  solomon_throne: ThroneScene,
  bethesda_pool: BethesdaScene,
  galilee_boat: GalileeBoatScene,
  synagogue_first_century: SynagogueScene,
};
void BRONZE; void CEDAR; void SAND; void DARK;
