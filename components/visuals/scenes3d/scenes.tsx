"use client";

// The three scenes, built from beveled boxes, lathe-like cylinders, curved tubes and procedural textures, lit by an offline studio
// environment so gold and bronze reflect light. Units: 1 cubit = 0.5. Schematic reconstructions from the dimensions in the Bible.
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";
import { linenTexture, metalTexture, stoneTexture, woodTexture } from "./textures";

type V3 = [number, number, number];
const GOLD = "#e0b53a", BRONZE = "#b0702f", CEDAR = "#a9794b", RED = "#9b3a2a", BLUE = "#3b5a7a", PURPLE = "#5b2f63";

export function Studio() {
  return (
    <Environment resolution={256} background={false}>
      <Lightformer form="rect" intensity={3.2} position={[0, 6, 4]} scale={[10, 4, 1]} color="#fff4dc" />
      <Lightformer form="rect" intensity={1.6} position={[-6, 3, -2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#ffe2b0" />
      <Lightformer form="rect" intensity={1.2} position={[6, 2, -4]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#dfe9ff" />
      <Lightformer form="ring" intensity={2} position={[0, 8, -6]} scale={6} color="#fff" />
    </Environment>
  );
}

function Gold({ hammered = true }: { hammered?: boolean }) {
  const map = useMemo(() => (hammered ? metalTexture("#d9aa2c") : undefined), [hammered]);
  return <meshStandardMaterial color={GOLD} map={map} metalness={0.68} roughness={0.34} envMapIntensity={1.4} emissive="#5e4500" emissiveIntensity={0.4} />;
}
function Bronze() {
  const map = useMemo(() => metalTexture("#a8672d"), []);
  return <meshStandardMaterial color={BRONZE} map={map} metalness={0.6} roughness={0.42} envMapIntensity={1.2} emissive="#3f2209" emissiveIntensity={0.3} />;
}
function Wood({ base = "#7a5230", repeat = [2, 1] as [number, number] }: { base?: string; repeat?: [number, number] }) {
  const map = useMemo(() => woodTexture(base, repeat), [base, repeat]);
  return <meshStandardMaterial map={map} roughness={0.85} metalness={0} />;
}
function Stone({ repeat = [3, 2] as [number, number] }: { repeat?: [number, number] }) {
  const map = useMemo(() => stoneTexture(repeat), [repeat]);
  return <meshStandardMaterial map={map} roughness={0.95} metalness={0} />;
}
function Linen({ repeat = [8, 2] as [number, number], color = "#ffffff" }: { repeat?: [number, number]; color?: string }) {
  const map = useMemo(() => linenTexture(repeat), [repeat]);
  return <meshStandardMaterial map={map} color={color} roughness={1} side={DoubleSide} />;
}

const Ground = ({ size = 40 }: { size?: number }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}><planeGeometry args={[size, size]} /><meshStandardMaterial color="#d8c8a2" roughness={1} /></mesh>
);

// ---- helpers ----
function Tube({ points, r = 0.03, children }: { points: V3[]; r?: number; children: React.ReactNode }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map((p) => new Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 24, r, 10, false]} />{children}</mesh>;
}

/** One wing: a fan of feathers (tapered boxes) rising and curving toward the center. */
function Wing({ side }: { side: 1 | -1 }) {
  const feathers = 7;
  return (
    <group position={[side * 0.1, 0.18, 0]}>
      {Array.from({ length: feathers }).map((_, i) => {
        const k = i / (feathers - 1);
        const len = 0.42 + 0.22 * Math.sin(k * Math.PI * 0.9);
        return (
          <mesh key={i} position={[side * (0.05 + k * 0.1), 0.18 + k * 0.1, -0.02 * i]} rotation={[0, 0, side * (-0.9 + k * 0.55)]}>
            <boxGeometry args={[0.07, len, 0.012]} /><Gold />
          </mesh>
        );
      })}
    </group>
  );
}

function Cherub({ x }: { x: number }) {
  const dir = x < 0 ? 1 : -1;
  return (
    <group position={[x, 0.92, 0]} rotation={[0, dir * 0.12, 0]}>
      <mesh position={[0, 0.2, 0]}><capsuleGeometry args={[0.1, 0.32, 8, 16]} /><Gold /></mesh>
      <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.095, 24, 24]} /><Gold /></mesh>
      <mesh position={[0, 0.17, 0.05]} rotation={[0.4, 0, 0]}><boxGeometry args={[0.2, 0.3, 0.02]} /><Gold /></mesh>
      <Wing side={1} /><Wing side={-1} />
    </group>
  );
}

function Ark({ position = [0, 0, 0] as V3, scale = 1 }) {
  const L = 1.25, H = 0.75, W = 0.75; // 2.5 x 1.5 x 1.5 cubits
  return (
    <group position={position} scale={scale}>
      {/* acacia core, visible through a thin gold overlay seam */}
      <RoundedBox args={[L * 2, H, W * 2]} radius={0.015} position={[0, H / 2, 0]}><Wood repeat={[3, 1]} /></RoundedBox>
      <RoundedBox args={[L * 2 + 0.025, H - 0.07, W * 2 + 0.025]} radius={0.02} smoothness={4} position={[0, H / 2 - 0.01, 0]}><Gold /></RoundedBox>
      {/* gold crown molding around the top */}
      <RoundedBox args={[L * 2 + 0.07, 0.06, W * 2 + 0.07]} radius={0.025} smoothness={4} position={[0, H - 0.02, 0]}><Gold /></RoundedBox>
      {/* mercy seat */}
      <RoundedBox args={[L * 2 + 0.02, 0.05, W * 2 + 0.02]} radius={0.015} position={[0, H + 0.04, 0]}><Gold /></RoundedBox>
      {/* rings and poles */}
      {[-1, 1].map((a) => [-1, 1].map((b) => <mesh key={`${a}${b}`} position={[a * (L - 0.1), 0.16, b * (W + 0.02)]} rotation={[0, 0, 0]}><torusGeometry args={[0.065, 0.022, 12, 24]} /><Gold /></mesh>))}
      {[-1, 1].map((b) => (
        <group key={b} position={[0, 0.16, b * (W + 0.1)]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, L * 2 + 1.3, 16]} /><Wood base="#6b4526" repeat={[1, 6]} /></mesh>
          {[-1, 1].map((e) => <mesh key={e} position={[e * (L + 0.65), 0, 0]}><sphereGeometry args={[0.04, 12, 12]} /><Gold /></mesh>)}
        </group>
      ))}
      <Cherub x={-0.5} /><Cherub x={0.5} />
    </group>
  );
}

export function ArkScene() {
  return <><Studio /><Ground size={14} /><Ark /></>;
}

// ---- Tabernacle ----
function Court() {
  const w = 5, d = 10; // 50 x 100 cubits at 0.1 per cubit
  const posts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) { posts.push([-w / 2, -d / 2 + i * (d / 10)]); posts.push([w / 2, -d / 2 + i * (d / 10)]); }
  for (let i = 1; i < 5; i++) { posts.push([-w / 2 + i * (w / 5), -d / 2]); posts.push([-w / 2 + i * (w / 5), d / 2]); }
  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.07, 0.08, 0.08, 12]} /><Bronze /></mesh>
          <mesh position={[0, 0.48, 0]}><cylinderGeometry args={[0.035, 0.04, 0.9, 12]} /><meshStandardMaterial color="#f1ece0" roughness={0.6} /></mesh>
          <mesh position={[0, 0.93, 0]}><sphereGeometry args={[0.045, 12, 12]} /><meshStandardMaterial color="#cfd3d6" metalness={1} roughness={0.25} envMapIntensity={1.2} /></mesh>
        </group>
      ))}
      {[[-w / 2, 0, 0.03, d], [w / 2, 0, 0.03, d]].map(([x, , sx, sz], i) => <mesh key={i} position={[x, 0.45, 0]}><boxGeometry args={[sx, 0.8, sz]} /><Linen repeat={[24, 2]} /></mesh>)}
      <mesh position={[0, 0.45, -d / 2]}><boxGeometry args={[w, 0.8, 0.03]} /><Linen repeat={[12, 2]} /></mesh>
      <mesh position={[-w / 4 - 0.6, 0.45, d / 2]}><boxGeometry args={[w / 2 - 1.2, 0.8, 0.03]} /><Linen repeat={[6, 2]} /></mesh>
      <mesh position={[w / 4 + 0.6, 0.45, d / 2]}><boxGeometry args={[w / 2 - 1.2, 0.8, 0.03]} /><Linen repeat={[6, 2]} /></mesh>
      {/* gate: blue, purple and scarlet */}
      {[BLUE, PURPLE, RED].map((c, i) => <mesh key={c} position={[-0.4 + i * 0.4, 0.45, d / 2]}><boxGeometry args={[0.4, 0.8, 0.03]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>)}
    </group>
  );
}

function Lampstand({ position = [0, 0, 0] as V3 }) {
  const arms = [-3, -2, -1, 1, 2, 3];
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.022, 0.03, 0.6, 12]} /><Gold /></mesh>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.1, 0.12, 0.04, 16]} /><Gold /></mesh>
      {arms.map((a) => {
        const x = a * 0.07, top = 0.55 + (Math.abs(a) === 3 ? 0 : Math.abs(a) === 2 ? 0 : 0);
        return <Tube key={a} r={0.012} points={[[0, 0.28, 0], [x * 0.55, 0.3 - Math.abs(a) * 0.01, 0], [x, 0.42, 0], [x, top, 0]]}><Gold /></Tube>;
      })}
      {[0, ...arms].map((a) => <mesh key={a} position={[a * 0.07, 0.6, 0]}><cylinderGeometry args={[0.022, 0.015, 0.04, 10]} /><Gold /></mesh>)}
      {[0, ...arms].map((a) => <mesh key={`f${a}`} position={[a * 0.07, 0.65, 0]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color="#ffd36b" emissive="#ff9d1a" emissiveIntensity={1.6} /></mesh>)}
    </group>
  );
}

function BronzeAltar({ position = [0, 0, 0] as V3 }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.9, 0.6, 0.9]} radius={0.02} position={[0, 0.3, 0]}><Bronze /></RoundedBox>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => <mesh key={`${a}${b}`} position={[a * 0.42, 0.66, b * 0.42]}><coneGeometry args={[0.045, 0.14, 10]} /><Bronze /></mesh>)}
      <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.78, 0.04, 0.78]} /><meshStandardMaterial color="#2a1a10" roughness={1} /></mesh>
      <mesh position={[0, 0.72, 0]}><coneGeometry args={[0.16, 0.3, 12]} /><meshStandardMaterial color="#ff8a1f" emissive="#ff6a00" emissiveIntensity={1.8} transparent opacity={0.9} /></mesh>
    </group>
  );
}

export function TabernacleScene() {
  return (
    <>
      <Studio />
      <Ground />
      <group scale={1.4}>
        <Court />
        <BronzeAltar position={[0, 0, 2.9]} />
        <group position={[0, 0, 1.1]}>{/* laver */}
          <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.14, 0.2, 0.24, 20]} /><Bronze /></mesh>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.36, 0.2, 0.18, 24]} /><Bronze /></mesh>
          <mesh position={[0, 0.385, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.34, 24]} /><meshStandardMaterial color="#6fa3b8" metalness={0.2} roughness={0.1} /></mesh>
        </group>
        <group position={[0, 0, -1.6]}>{/* tent 30 x 10 x 10 cubits */}
          <mesh position={[0, 0.75, 0]}><boxGeometry args={[1.6, 1.5, 4.6]} /><Wood base="#b88a4a" repeat={[6, 2]} /></mesh>
          <mesh position={[0, 1.52, 0]}><boxGeometry args={[1.78, 0.07, 4.78]} /><meshStandardMaterial color={RED} roughness={0.95} /></mesh>
          <mesh position={[0, 1.58, 0]}><boxGeometry args={[1.84, 0.05, 4.84]} /><meshStandardMaterial color="#2d2723" roughness={1} /></mesh>
          <mesh position={[0, 0.75, -0.75]}><boxGeometry args={[1.62, 1.4, 0.04]} /><meshStandardMaterial color={BLUE} roughness={0.9} /></mesh>
          <mesh position={[0, 0.75, 2.31]}><boxGeometry args={[1.62, 1.4, 0.04]} /><meshStandardMaterial color={PURPLE} roughness={0.9} /></mesh>
        </group>
        <mesh position={[0.35, 0.36, -0.2]}><boxGeometry args={[0.4, 0.04, 0.25]} /><Gold /></mesh>
        <Lampstand position={[-0.38, 0.02, -0.2]} />
        <mesh position={[0, 0.3, -0.7]}><boxGeometry args={[0.22, 0.45, 0.22]} /><Gold /></mesh>
        <Ark position={[0, 0.02, -1.55]} scale={0.22} />
      </group>
    </>
  );
}

// ---- Solomon's Temple ----
function Column({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.28, 0.32, 0.3, 20]} /><Bronze /></mesh>
      <mesh position={[0, 1.9, 0]}><cylinderGeometry args={[0.2, 0.22, 3.4, 24]} /><Bronze /></mesh>
      <mesh position={[0, 3.75, 0]}><cylinderGeometry args={[0.42, 0.22, 0.5, 20]} /><Bronze /></mesh>
      {Array.from({ length: 12 }).map((_, i) => <mesh key={i} position={[Math.cos((i / 12) * Math.PI * 2) * 0.36, 3.55, Math.sin((i / 12) * Math.PI * 2) * 0.36]}><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color="#8c3b2a" roughness={0.6} /></mesh>)}
    </group>
  );
}

function BronzeSea({ position = [0, 0, 0] as V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.95, 0.78, 0.56, 36, 1, true]} /><meshStandardMaterial color={BRONZE} metalness={0.6} roughness={0.42} side={DoubleSide} envMapIntensity={1.2} emissive="#3f2209" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.95, 0.04, 10, 36]} /><Bronze /></mesh>
      <mesh position={[0, 0.88, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.92, 32]} /><meshStandardMaterial color="#6fa3b8" metalness={0.2} roughness={0.1} /></mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 0.62, 0.22, Math.sin(a) * 0.62]} rotation={[0, -a, 0]}><boxGeometry args={[0.34, 0.34, 0.2]} /><Bronze /></mesh>;
      })}
    </group>
  );
}

export function TempleScene() {
  return (
    <>
      <Studio />
      <Ground size={48} />
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[9.4, 0.4, 7.4]} /><Stone repeat={[6, 1]} /></mesh>
      <mesh position={[0, 2.2, 0]}><boxGeometry args={[3.2, 3.6, 8]} /><Stone repeat={[4, 3]} /></mesh>
      <mesh position={[0, 4.05, 0]}><boxGeometry args={[3.5, 0.2, 8.3]} /><Wood base={CEDAR} repeat={[3, 1]} /></mesh>
      <mesh position={[0, 1.2, 4.1]}><boxGeometry args={[3.2, 1.6, 2.2]} /><Stone repeat={[4, 2]} /></mesh>
      <mesh position={[0, 2.5, 4.1]}><boxGeometry args={[3.3, 1.2, 2.3]} /><Wood base={CEDAR} repeat={[2, 1]} /></mesh>
      <mesh position={[0, 1.7, -2.8]}><boxGeometry args={[2.9, 2.4, 2.4]} /><Gold /></mesh>
      {[-2.15, 2.15].map((x) => [-2.2, 0, 2.2].map((z) => <mesh key={`${x}${z}`} position={[x, 1.1, z]}><boxGeometry args={[1.0, 1.8, 1.7]} /><Stone repeat={[2, 2]} /></mesh>))}
      <Column x={-0.95} z={5.5} /><Column x={0.95} z={5.5} />
      <BronzeSea position={[-3.6, 0, 4.2]} />
      <mesh position={[3.4, 0.55, 4.2]}><boxGeometry args={[1.2, 0.9, 1.2]} /><Bronze /></mesh>{/* altar of burnt offering */}
      <mesh position={[0, 0.35, 8]}><boxGeometry args={[7.4, 0.5, 4.2]} /><Stone repeat={[6, 1]} /></mesh>
    </>
  );
}
