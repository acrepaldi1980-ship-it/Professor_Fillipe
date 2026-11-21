"use client";

// Test environment (Prompt 3.1): a walkable courtyard used to prove the engine: columns with levels of detail, a low wall, an altar block and a fire.
// Not a biblical reconstruction; the real environments (the Tabernacle, Prompt 3.2) are separate packages and scenes.
import { DoubleSide } from "three";

type Detail = 0 | 1 | 2;
const Mat = ({ c, r = 0.95 }: { c: string; r?: number }) => <meshStandardMaterial color={c} roughness={r} side={DoubleSide} />;
const SAND = "#d4bd91", STONE = "#cbbf9e", DARK = "#6a5236";

export function TestYardScene({ detail }: { detail: Detail }) {
  const seg = detail === 0 ? 20 : detail === 1 ? 10 : 6;
  const cols = [[-6, -6], [6, -6], [-6, 6], [6, 6], [-6, 0], [6, 0]] as [number, number][];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[40, 40]} /><Mat c={SAND} /></mesh>
      {cols.map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 2, z]}><cylinderGeometry args={[0.5, 0.55, 4, seg]} /><Mat c={STONE} /></mesh>)}
      <mesh position={[0, 0.6, 12]}><boxGeometry args={[16, 1.2, 0.6]} /><Mat c={STONE} /></mesh>
    </group>
  );
}

export function TestAltarScene({ detail }: { detail: Detail }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -30]}><planeGeometry args={[40, 40]} /><Mat c="#cdb48a" /></mesh>
      <mesh position={[0, 0.8, -30]}><boxGeometry args={[3, 1.6, 3]} /><Mat c={DARK} /></mesh>
      <mesh position={[0, 1.95, -30]}><coneGeometry args={[0.5, detail === 2 ? 0.6 : 1.0, detail === 0 ? 10 : 5]} /><meshStandardMaterial color="#ffb347" emissive="#ff7a14" emissiveIntensity={1.6} /></mesh>
      {detail < 2 && <pointLight position={[0, 2.6, -30]} intensity={6} distance={14} color="#ff9a3c" />}
    </group>
  );
}

export const TEST_SCENES: Record<string, (p: { detail: Detail }) => React.JSX.Element> = { test_yard: TestYardScene, test_altar: TestAltarScene };
