"use client";

// Five more scenes (Prompt 2.6: 20 models). Same building blocks as scenes-extra.tsx. Schematic reconstructions; no figure of Jesus or of God the
// Father is ever drawn (RA-20).
import { DoubleSide } from "three";
import { Bronze, Ground, Linen, Studio, Tube } from "./scenes";
import { Box, CLAY, Cyl, DARK, GRASS, Mat, SAND, WATER, type V3 } from "./scenes-extra";

const LIMESTONE = "#e6d7b4", GOLDEN = "#d9b45a", ROOF = "#b5603c";

// ---------- Herod's temple (esplanade, sanctuary, porticoes, Antonia) ----------
export function HerodTempleScene() {
  const cols = (z: number, x0: number, x1: number, n: number) => Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1)).map((x) => <Cyl key={`${x}-${z}`} p={[x, 0.55, z]} r={0.09} h={0.9} c={LIMESTONE} seg={12} />);
  return (
    <>
      <Studio />
      <Ground size={30} />
      <Box p={[0, 0.12, 0]} s={[12, 0.24, 9]} c={LIMESTONE} stone />
      {/* Court of the Gentiles porticoes: Royal Portico (south), Solomon's Portico (east) */}
      <Box p={[0, 0.8, 4.2]} s={[11.6, 0.14, 1.0]} c={LIMESTONE} />
      {cols(4.2, -5.6, 5.6, 14)}
      <Box p={[5.7, 0.8, 0]} s={[1.0, 0.14, 8.4]} c={LIMESTONE} />
      {Array.from({ length: 10 }, (_, i) => <Cyl key={i} p={[5.7, 0.55, -4 + i * 0.9]} r={0.09} h={0.9} c={LIMESTONE} seg={12} />)}
      {/* inner court wall and the sanctuary */}
      <Box p={[-0.8, 0.5, 0]} s={[5.2, 0.7, 4.6]} c={LIMESTONE} stone />
      <Box p={[-1.9, 1.5, 0]} s={[2.6, 1.6, 2.2]} c={LIMESTONE} stone />
      <Box p={[-3.6, 1.2, 0]} s={[1.2, 2.0, 2.8]} c={LIMESTONE} stone />
      <mesh position={[-3.62, 2.5, 0]}><boxGeometry args={[1.3, 0.12, 2.9]} /><Mat c={GOLDEN} m={0.6} r={0.35} /></mesh>
      {/* altar in front of the sanctuary */}
      <Box p={[0.9, 0.95, 0]} s={[0.9, 0.5, 0.9]} c="#cfc09a" stone />
      {/* Antonia fortress, north-west corner */}
      <Box p={[-5, 1.0, -3.6]} s={[1.6, 1.8, 1.6]} c="#bfae86" stone />
      {[[-5.7, -4.3], [-4.3, -4.3], [-5.7, -2.9], [-4.3, -2.9]].map(([x, z], i) => <Cyl key={i} p={[x, 2.2, z]} r={0.22} h={1.2} c="#bfae86" seg={10} />)}
    </>
  );
}

// ---------- The altar of burnt offering (Ex 27) ----------
export function BurntAltarScene() {
  return (
    <>
      <Studio />
      <Ground size={16} />
      <mesh position={[0, 1.0, 0]}><boxGeometry args={[2.4, 1.4, 2.4]} /><meshStandardMaterial color="#8a5a34" roughness={0.9} /></mesh>
      <mesh position={[0, 1.0, 0]}><boxGeometry args={[2.46, 1.46, 2.46]} /><Bronze /></mesh>
      {([[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]] as [number, number][]).map(([x, z], i) => <mesh key={i} position={[x, 1.95, z]}><coneGeometry args={[0.16, 0.5, 8]} /><Bronze /></mesh>)}
      <mesh position={[0, 1.78, 0]}><boxGeometry args={[1.9, 0.08, 1.9]} /><meshStandardMaterial color="#2a2018" roughness={1} /></mesh>
      <mesh position={[0, 2.05, 0]}><coneGeometry args={[0.45, 0.7, 10]} /><meshStandardMaterial color="#ffb347" emissive="#ff7a14" emissiveIntensity={1.4} /></mesh>
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[2.9, 0.1, 2.9]} /><Bronze /></mesh>
      {([[-1.45, 0.4], [1.45, 0.4]] as [number, number][]).map(([x, y], i) => <mesh key={i} position={[x, y + 0.6, 0]}><torusGeometry args={[0.1, 0.03, 8, 16]} /><Bronze /></mesh>)}
      <Cyl p={[-2.0, 0.6, 0]} r={0.05} h={4.0} c="#7a5230" seg={8} />
      <mesh position={[-1.75, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 3.4, 8]} /><meshStandardMaterial color="#7a5230" /></mesh>
    </>
  );
}

// ---------- The bronze serpent (Nm 21) ----------
export function BronzeSerpentScene() {
  const pts: V3[] = [[0, 3.6, 0], [0.45, 3.3, 0.12], [-0.4, 2.9, -0.1], [0.4, 2.5, 0.1], [-0.35, 2.15, -0.08], [0.3, 1.85, 0.06]];
  return (
    <>
      <Studio />
      <Ground size={18} />
      <mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.1, 0.14, 3.6, 12]} /><meshStandardMaterial color="#6b4a2b" roughness={0.95} /></mesh>
      <mesh position={[0, 3.0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 1.4, 10]} /><meshStandardMaterial color="#6b4a2b" roughness={0.95} /></mesh>
      <Tube points={pts} r={0.09}><Bronze /></Tube>
      <mesh position={[0, 3.72, 0]}><sphereGeometry args={[0.15, 14, 14]} /><Bronze /></mesh>
      {([[-2.4, 0.2], [2.2, -0.6], [-1.4, 1.8]] as [number, number][]).map(([x, z], i) => <mesh key={i} position={[x, 0.16, z]} rotation={[0, i, 0]}><boxGeometry args={[0.7, 0.28, 0.45]} /><Mat c={SAND} /></mesh>)}
    </>
  );
}

// ---------- The upper room (Mk 14:12-16, Ac 1:13) ----------
export function UpperRoomScene() {
  return (
    <>
      <Studio />
      <Ground size={20} />
      <Box p={[0, 1.0, 0]} s={[6, 2.0, 5]} c="#d8c39b" stone />
      {/* upper floor walls, cut away at the front so the room can be seen */}
      <Box p={[0, 2.7, -2.4]} s={[6, 1.3, 0.2]} c="#d8c39b" stone />
      <Box p={[-2.9, 2.7, 0]} s={[0.2, 1.3, 5]} c="#d8c39b" stone />
      <Box p={[2.9, 2.7, -1.2]} s={[0.2, 1.3, 2.6]} c="#d8c39b" stone />
      {/* outside stair up to the room */}
      {Array.from({ length: 6 }, (_, i) => <Box key={i} p={[3.55, 0.15 + i * 0.32, 1.6 - i * 0.2]} s={[0.9, 0.3 + i * 0.0, 0.5]} c="#c9b289" stone />)}
      {/* cutaway: floor of the room with a low U-shaped table and cushions */}
      <mesh position={[0, 2.05, 0]}><boxGeometry args={[5.6, 0.08, 4.6]} /><meshStandardMaterial color="#8a6a45" roughness={0.9} /></mesh>
      <Box p={[0, 2.35, -0.2]} s={[2.6, 0.3, 0.7]} c="#6b4a2b" wood />
      <Box p={[-1.5, 2.35, 0.7]} s={[0.7, 0.3, 2.0]} c="#6b4a2b" wood />
      <Box p={[1.5, 2.35, 0.7]} s={[0.7, 0.3, 2.0]} c="#6b4a2b" wood />
      {[[-1.9, 1.8], [-1.9, 0.4], [1.9, 1.8], [1.9, 0.4], [-0.9, -1.0], [0, -1.0], [0.9, -1.0]].map(([x, z], i) => <mesh key={i} position={[x, 2.14, z]}><boxGeometry args={[0.5, 0.1, 0.5]} /><Linen /></mesh>)}
      {/* oil lamps and the window */}
      <mesh position={[0, 2.62, -0.2]}><sphereGeometry args={[0.08, 10, 10]} /><meshStandardMaterial color="#ffd36a" emissive="#ff9a1f" emissiveIntensity={1.5} /></mesh>
      <mesh position={[0, 3.0, -2.28]}><boxGeometry args={[1.0, 0.7, 0.08]} /><meshStandardMaterial color="#9ec3d6" emissive="#9ec3d6" emissiveIntensity={0.6} /></mesh>
    </>
  );
}

// ---------- Jacob's well (Jn 4:5-14) ----------
export function JacobWellScene() {
  return (
    <>
      <Studio />
      <Ground size={20} />
      <mesh position={[0, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[4.2, 40]} /><meshStandardMaterial color={SAND} roughness={1} /></mesh>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.8, 0.9, 0.9, 28, 1, true]} /><meshStandardMaterial color="#c8b48a" roughness={0.95} side={DoubleSide} /></mesh>
      <mesh position={[0, 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.85, 0.12, 10, 28]} /><meshStandardMaterial color="#b9a478" roughness={0.9} /></mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.72, 24]} /><meshStandardMaterial color={WATER} roughness={0.2} metalness={0.2} /></mesh>
      <Box p={[-1.2, 1.3, 0]} s={[0.12, 1.2, 0.12]} c={DARK} wood />
      <Box p={[1.2, 1.3, 0]} s={[0.12, 1.2, 0.12]} c={DARK} wood />
      <mesh position={[0, 1.9, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 2.5, 10]} /><meshStandardMaterial color="#6b4a2b" /></mesh>
      <mesh position={[1.6, 0.4, 0.9]}><sphereGeometry args={[0.28, 16, 14]} /><meshStandardMaterial color={CLAY} roughness={0.9} /></mesh>
      <mesh position={[1.6, 0.72, 0.9]}><cylinderGeometry args={[0.1, 0.16, 0.18, 14]} /><meshStandardMaterial color={CLAY} roughness={0.9} /></mesh>
      {([[-3, -2], [3, -3], [-2.6, 2.8]] as [number, number][]).map(([x, z], i) => <mesh key={i} position={[x, 0.7, z]}><coneGeometry args={[0.6, 1.4, 10]} /><meshStandardMaterial color={GRASS} roughness={1} /></mesh>)}
      <mesh position={[-2.4, 0.18, 1.2]}><boxGeometry args={[0.9, 0.35, 0.5]} /><Mat c={SAND} /></mesh>
    </>
  );
}

export const EXTRA_SCENES_2: Record<string, () => React.JSX.Element> = {
  herod_temple: HerodTempleScene,
  burnt_altar: BurntAltarScene,
  bronze_serpent: BronzeSerpentScene,
  upper_room: UpperRoomScene,
  jacob_well: JacobWellScene,
};
void ROOF;
