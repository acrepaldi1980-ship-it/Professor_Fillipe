"use client";

// Noah's ark (docs/ambientes/arca-de-noe.md): the outside (hull, door and ramp, the animals arriving, the work site, the rainbow) and the inside (three decks, ramps,
// stalls with animals, the granary, the birds, the window and the dove). Measures from lib/immersive/arca.ts. Procedural, instanced and light.
import { useMemo } from "react";
import { DoubleSide } from "three";
import { Animals, type AnimalKind } from "./animals";
import { Flame, Instances, paintHammered, paintHay, paintPitch, paintSand, paintWood, Smoke, useTexture } from "./proc";
import { ARK, CORRIDOR, DECK, DOOR, INNER, RAMPS, RAMP_OUT, STALL_BLOCKS } from "@/lib/immersive/arca";

type Detail = 0 | 1 | 2;
type Item = [number, number, number, number?, number?];
const H = ARK.height, W = ARK.halfW, L = ARK.halfL;
const rand = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const Mat = ({ c, r = 0.9, m = 0, map, side }: { c?: string; r?: number; m?: number; map?: import("three").Texture; side?: typeof DoubleSide }) => <meshStandardMaterial color={c ?? "#ffffff"} roughness={r} metalness={m} map={map} side={side} />;

export function ArkExterior({ detail }: { detail: Detail }) {
  const wall = useTexture(paintWood("#5b4330", 56, 0.45), 512, 256, [40, 3], 3);
  const roof = useTexture(paintWood("#6a4d33", 48, 0.4), 512, 256, [30, 2], 5);
  const pitch = useTexture(paintPitch, 256, 256, [30, 2], 9);
  const ground = useTexture(paintSand, 256, 256, [90, 90], 4);
  const planks = useTexture(paintWood("#8a6a45", 40, 0.35), 256, 256, [3, 1], 6);

  // scenery: trees and rocks around, none close to the ark or the approach
  const trees = useMemo<{ t: Item[]; c: Item[] }>(() => {
    const r = rand(21), t: Item[] = [], c: Item[] = [];
    for (let i = 0; i < (detail === 0 ? 70 : 40); i++) {
      const a = r() * Math.PI * 2, d = 55 + r() * 130, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(z) < 75 && x > -80 && x < 40) continue;
      const s = 0.8 + r() * 0.9;
      t.push([x, 1.6 * s, z, 0, s]); c.push([x, 4.2 * s, z, r() * 3, s]);
    }
    return { t, c };
  }, [detail]);
  const rocks = useMemo<Item[]>(() => { const r = rand(33); return Array.from({ length: 40 }, () => { const a = r() * 6.28, d = 30 + r() * 150; return [Math.cos(a) * d, 0.3, Math.sin(a) * d, r() * 3, 0.5 + r() * 1.6] as Item; }).filter(([x, , z]) => !(Math.abs(z) < 12 && x < 5 && x > -60) && !(Math.abs(x) < W + 3 && Math.abs(z) < L + 3)); }, []);
  const hills = useMemo<Item[]>(() => Array.from({ length: 12 }, (_, i) => [Math.cos(i * 0.52) * 235, 20, Math.sin(i * 0.52) * 235, 0, 18 + (i % 3) * 8] as Item), []);
  const clouds = useMemo<Item[]>(() => { const r = rand(5); return Array.from({ length: 26 }, () => { const a = r() * 6.28, d = 140 + r() * 90; return [Math.cos(a) * d, 60 + r() * 40, Math.sin(a) * d, 0, 14 + r() * 18] as Item; }); }, []);
  // the animals arriving in pairs, nose to tail along the approach to the door
  const queue = useMemo(() => {
    const out: Record<AnimalKind, Item[]> = { sheep: [], ox: [], lion: [], giraffe: [], elephant: [], bird: [] };
    const order: AnimalKind[] = ["elephant", "giraffe", "ox", "lion", "sheep", "ox", "lion", "sheep", "sheep"];
    order.forEach((k, i) => { const x = -46 - i * 6; out[k].push([x, 0, -1.6, 0, 1], [x, 0, 1.6, 0.05, 1]); });
    return out;
  }, []);
  const strakes = useMemo(() => Array.from({ length: 12 }, (_, i) => 1.3 + i * 1.0), []);
  const posts = useMemo<Item[]>(() => Array.from({ length: Math.floor((2 * L) / 4.5) + 1 }, (_, i) => -L + i * 4.5 + 0.1).flatMap((z) => [[-W - 0.3, H - 0.68, z], [W + 0.3, H - 0.68, z]] as Item[]), []);
  const slope = Math.atan2(2.4, W + 0.8), slant = Math.hypot(W + 0.8, 2.4);
  const rampLen = RAMP_OUT.toX - RAMP_OUT.fromX, rampAng = Math.atan2(DECK.d1, -rampLen);

  return (
    <group>
      <hemisphereLight args={["#dfe9f2", "#8a7a55", 0.85]} />
      <directionalLight position={[60, 90, 40]} intensity={1.7} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[900, 900]} /><Mat c="#a89a6c" map={ground} r={1} /></mesh>
      <Instances items={hills}><sphereGeometry args={[1, 10, 6]} /><Mat c="#7d7352" r={1} /></Instances>
      <Instances items={clouds}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#aeb4bb" transparent opacity={0.8} roughness={1} /></Instances>
      <Instances items={trees.t}><cylinderGeometry args={[0.28, 0.4, 3.2, 6]} /><Mat c="#5b4330" /></Instances>
      <Instances items={trees.c}><coneGeometry args={[2.2, 5.5, 7]} /><Mat c="#4f6b3a" /></Instances>
      <Instances items={rocks}><dodecahedronGeometry args={[1, 0]} /><Mat c="#8d8470" /></Instances>

      {/* the hull: planks soaked in pitch inside and out (Gn 6:14) */}
      <mesh position={[-W - 0.2, (H - 0.9) / 2, -(L + DOOR.halfW) / 2]}><boxGeometry args={[0.5, H - 0.9, L - DOOR.halfW]} /><Mat map={wall} c="#c9b8a4" side={DoubleSide} /></mesh>
      <mesh position={[-W - 0.2, (H - 0.9) / 2, (L + DOOR.halfW) / 2]}><boxGeometry args={[0.5, H - 0.9, L - DOOR.halfW]} /><Mat map={wall} c="#c9b8a4" side={DoubleSide} /></mesh>
      <mesh position={[-W - 0.2, (DOOR.height + H - 0.9) / 2, 0]}><boxGeometry args={[0.5, H - 0.9 - DOOR.height, DOOR.halfW * 2]} /><Mat map={wall} c="#c9b8a4" side={DoubleSide} /></mesh>
      <mesh position={[W + 0.2, (H - 0.9) / 2, 0]}><boxGeometry args={[0.5, H - 0.9, 2 * L]} /><Mat map={wall} c="#c9b8a4" side={DoubleSide} /></mesh>
      <mesh position={[0, (H - 0.45) / 2, -L - 0.2]}><boxGeometry args={[2 * W + 0.9, H - 0.45, 0.5]} /><Mat map={wall} c="#c9b8a4" side={DoubleSide} /></mesh>
      <mesh position={[0, (H - 0.45) / 2, L + 0.2]}><boxGeometry args={[2 * W + 0.9, H - 0.45, 0.5]} /><Mat map={wall} c="#c9b8a4" side={DoubleSide} /></mesh>
      <mesh position={[-W - 0.2, H - 0.22, 0]}><boxGeometry args={[0.6, 0.45, 2 * L + 1]} /><Mat map={pitch} side={DoubleSide} r={0.5} /></mesh>
      <mesh position={[W + 0.2, H - 0.22, 0]}><boxGeometry args={[0.6, 0.45, 2 * L + 1]} /><Mat map={pitch} side={DoubleSide} r={0.5} /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[2 * W + 1.4, 0.7, 2 * L + 1.4]} /><Mat map={pitch} r={0.5} /></mesh>
      {/* the window: a band 1 cubit high right under the roof, along both sides (Gn 6:16): posts between the openings */}
      <Instances items={posts}><boxGeometry args={[0.45, 0.5, 0.4]} /><Mat map={pitch} r={0.6} /></Instances>
      {/* horizontal strakes (planking lines) with the pitch showing between them */}
      {strakes.map((y) => (
        <group key={y}>
          <mesh position={[W + 0.55, y, 0]}><boxGeometry args={[0.12, 0.16, 2 * L]} /><Mat map={pitch} r={0.45} /></mesh>
          {y > DOOR.height + 0.3 ? <mesh position={[-W - 0.55, y, 0]}><boxGeometry args={[0.12, 0.16, 2 * L]} /><Mat map={pitch} r={0.45} /></mesh> : (
            <>
              <mesh position={[-W - 0.55, y, -(L + DOOR.halfW) / 2]}><boxGeometry args={[0.12, 0.16, L - DOOR.halfW]} /><Mat map={pitch} r={0.45} /></mesh>
              <mesh position={[-W - 0.55, y, (L + DOOR.halfW) / 2]}><boxGeometry args={[0.12, 0.16, L - DOOR.halfW]} /><Mat map={pitch} r={0.45} /></mesh>
            </>
          )}
        </group>
      ))}
      {/* the covering: a low gabled roof is a reconstruction (Gn 8:13 only says "cobertura") */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * (W + 0.8) / 2, H + 1.2, 0]} rotation={[0, 0, -s * slope]}><boxGeometry args={[slant, 0.25, 2 * L + 1.6]} /><Mat map={roof} side={DoubleSide} /></mesh>)}
      <mesh position={[0, H + 2.5, 0]}><boxGeometry args={[0.7, 0.45, 2 * L + 1.8]} /><Mat map={pitch} r={0.5} /></mesh>

      {/* the door "at its side" (Gn 6:16), open, with its ramp */}
      <mesh position={[-W - 0.9, DOOR.height / 2, DOOR.halfW + 0.15]}><boxGeometry args={[0.4, DOOR.height + 0.4, 0.4]} /><Mat map={pitch} r={0.5} /></mesh>
      <mesh position={[-W - 0.9, DOOR.height / 2, -DOOR.halfW - 0.15]}><boxGeometry args={[0.4, DOOR.height + 0.4, 0.4]} /><Mat map={pitch} r={0.5} /></mesh>
      <mesh position={[-W - 0.9, DOOR.height + 0.25, 0]}><boxGeometry args={[0.45, 0.5, DOOR.halfW * 2 + 0.9]} /><Mat map={pitch} r={0.5} /></mesh>
      <mesh position={[-W - 2.6, DOOR.height / 2, DOOR.halfW + 2.2]} rotation={[0, 1.15, 0]}><boxGeometry args={[DOOR.halfW, DOOR.height, 0.3]} /><Mat map={planks} c="#9c7d58" /></mesh>
      <mesh position={[(RAMP_OUT.fromX + RAMP_OUT.toX) / 2, DECK.d1 / 2 - 0.12, 0]} rotation={[0, 0, rampAng]}><boxGeometry args={[Math.hypot(rampLen, DECK.d1), 0.24, DOOR.halfW * 2 + 0.4]} /><Mat map={planks} c="#a98a62" /></mesh>
      {Array.from({ length: 9 }, (_, i) => RAMP_OUT.fromX + 1 + i * (rampLen - 1.5) / 8).flatMap((x) => [-1, 1].map((s) => <mesh key={`${x}${s}`} position={[x, (DECK.d1 * (x - RAMP_OUT.fromX)) / rampLen + 0.55, s * (DOOR.halfW + 0.25)]}><boxGeometry args={[0.12, 1.1, 0.12]} /><Mat map={pitch} r={0.6} /></mesh>))}

      {/* the work site: a pot of boiling pitch, timber stacks, a ladder against the hull */}
      <group position={[-17, 0, 6.5]}>
        <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.7, 0.55, 1.0, 10]} /><Mat c="#2b2b2b" m={0.4} r={0.6} /></mesh>
        <mesh position={[0, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.62, 10]} /><Mat c="#1a1410" r={0.2} /></mesh>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[1.5, 0.25, 1.5]} /><Mat c="#4a3a2a" /></mesh>
        <Flame size={0.8} intensity={detail < 2 ? 4 : 0} position={[0, 0.5, 1.0]} />
        {detail < 2 && <Smoke count={10} height={5} spread={0.5} color="#4b4540" radius={0.28} position={[0, 1.1, 0]} />}
      </group>
      {[[-14, 0.3, -19, 0.1], [-19, 0.3, -22, -0.2], [-12, 0.3, 20, 0.15]].map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          {Array.from({ length: 6 }, (_, k) => <mesh key={k} position={[0, k * 0.2, 0]}><boxGeometry args={[5.5, 0.18, 0.5 + (k % 2) * 0.08]} /><Mat map={planks} c={k % 2 ? "#a98a62" : "#957650"} /></mesh>)}
          <mesh position={[0, -0.15, 0.7]}><boxGeometry args={[5.5, 0.2, 0.2]} /><Mat c="#4a3a2a" /></mesh>
        </group>
      ))}
      <group position={[W + 1.2, 6.6, 6]} rotation={[0, 0, -0.16]}>
        {[-0.45, 0.45].map((z) => <mesh key={z} position={[0, 0, z]}><boxGeometry args={[0.1, 13.3, 0.1]} /><Mat c="#7a5c3a" /></mesh>)}
        {Array.from({ length: 24 }, (_, i) => <mesh key={i} position={[0, -6.2 + i * 0.52, 0]}><boxGeometry args={[0.08, 0.07, 0.9]} /><Mat c="#7a5c3a" /></mesh>)}
      </group>

      {/* the animals arriving, two by two (Gn 6:19-20) */}
      {(Object.keys(queue) as AnimalKind[]).map((k) => <Animals key={k} kind={k} items={queue[k]} />)}

      {/* the sign of the covenant: a rainbow far to the east (Gn 9:13), only light and color */}
      <group position={[190, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        {["#d6453d", "#e4802f", "#e9c93a", "#5aa85a", "#4a8fd0", "#4a58b4", "#7a4aa4"].map((c, i) => <mesh key={c} position={[0, 0, 0]}><torusGeometry args={[78 - i * 2.6, 1.3, 6, 48, Math.PI]} /><meshBasicMaterial color={c} transparent opacity={0.55} /></mesh>)}
      </group>
    </group>
  );
}

const BLOCK_KINDS: Record<string, (AnimalKind | "granary" | "birds")[]> = {
  deck1: ["elephant", "giraffe", "ox", "lion", "ox", "sheep"],
  deck2: ["sheep", "sheep", "granary", "granary", "ox"],
  deck3: ["birds", "birds", "birds", "birds", "birds"],
};

export function ArkInterior({ detail }: { detail: Detail }) {
  const floorTex = useTexture(paintWood("#9a7a52", 44, 0.35), 256, 256, [3, 24], 8);
  const wallTex = useTexture(paintWood("#8c6c46", 48, 0.4), 256, 256, [40, 2], 10);
  const hayTex = useTexture(paintHay, 256, 256, [3, 5], 12);
  const pitch = useTexture(paintPitch, 256, 256, [4, 2], 9);
  const iron = useTexture(paintHammered("#6b6b6b"), 128, 128, [1, 1], 14);

  const decks = useMemo(() => [
    { id: "deck1", y: DECK.d1, z0: -INNER.z, z1: INNER.z, blocks: STALL_BLOCKS },
    { id: "deck2", y: DECK.d2, z0: -INNER.z, z1: 47, blocks: STALL_BLOCKS.slice(0, 5) },
    { id: "deck3", y: DECK.d3, z0: -47, z1: INNER.z, blocks: STALL_BLOCKS.slice(1) },
  ], []);

  const built = useMemo(() => {
    const r = rand(77);
    const slats: Item[] = [], ribs: Item[] = [], beams: Item[] = [], partitions: Item[] = [];
    const hay19: Item[] = [], hay28: Item[] = [], rail19: Item[] = [], rail28: Item[] = [];
    const animals: Record<AnimalKind, Item[]> = { sheep: [], ox: [], lion: [], giraffe: [], elephant: [], bird: [] };
    const sacks: Item[] = [], jars: Item[] = [], bales: Item[] = [], barrels: Item[] = [], cages: Item[] = [];
    for (const d of decks) {
      const kinds = BLOCK_KINDS[d.id];
      for (let z = d.z0 + 3; z < d.z1; z += 6) { for (const s of [-1, 1]) ribs.push([s * (INNER.x - 0.2), d.y + 2.1, z]); beams.push([0, d.y + 4.05, z]); }
      d.blocks.forEach(([z0, z1], bi) => {
        const len = z1 - z0, zc = (z0 + z1) / 2, kind = kinds[bi];
        for (const s of [-1, 1]) {
          const xc = s * ((CORRIDOR + INNER.x - 0.3) / 2);
          for (let z = z0 + 0.3; z <= z1 - 0.2; z += 0.45) slats.push([s * (CORRIDOR + 0.12), d.y + 1.3, z]);
          for (const y of [0.4, 1.4, 2.5]) (len > 20 ? rail28 : rail19).push([s * (CORRIDOR + 0.12), d.y + y, zc]);
          (len > 20 ? hay28 : hay19).push([xc, d.y + 0.07, zc]);
          for (let z = z0 + 9.5; z < z1 - 3; z += 9.5) partitions.push([xc, d.y + 1.3, z]);
          if (kind === "granary") {
            for (let i = 0; i < 26; i++) sacks.push([xc + (r() - 0.5) * 4.6, d.y + 0.3 + (i % 3 === 0 ? 0.5 : 0), z0 + 1 + (i / 26) * (len - 2), r() * 3, 0.8 + r() * 0.3]);
            for (let i = 0; i < 10; i++) jars.push([xc + (r() - 0.5) * 4.6, d.y + 0.5, z0 + 1.5 + r() * (len - 3), 0, 0.9 + r() * 0.3]);
            for (let i = 0; i < 8; i++) bales.push([xc + (r() - 0.5) * 4.6, d.y + 0.3 + (i % 2) * 0.55, z0 + 1.5 + r() * (len - 3), r() * 0.6, 1]);
            for (let i = 0; i < 4; i++) barrels.push([xc + (r() - 0.5) * 4, d.y + 0.55, z0 + 2 + r() * (len - 4), 0, 1]);
          } else if (kind === "birds") {
            for (let z = z0 + 1.2; z < z1 - 1; z += 1.5) for (const lvl of [0.35, 1.45]) { cages.push([xc - s * 3.2, d.y + lvl + 0.05, z, 0, 1]); animals.bird.push([xc - s * 3.2, d.y + lvl - 0.05, z, s > 0 ? Math.PI : 0, 2.2]); }
          } else if (kind !== undefined) {
            const k = kind as AnimalKind, step = k === "elephant" || k === "giraffe" ? 9.5 : 4.7, n = Math.max(1, Math.floor((len - 2) / step));
            for (let i = 0; i < n; i++) animals[k].push([xc + (r() - 0.5) * 0.8, d.y, z0 + 1.8 + i * step + (len - 2 - (n - 1) * step) / 2, (s > 0 ? Math.PI : 0) + Math.PI / 2 + (r() - 0.5) * 0.4, k === "sheep" ? 1.1 : 1]);
          }
        }
      });
    }
    return { slats, ribs, beams, partitions, hay19, hay28, rail19, rail28, animals, sacks, jars, bales, barrels, cages };
  }, [decks]);

  const rampA = Math.atan2(DECK.d2 - DECK.d1, RAMPS.a.z1 - RAMPS.a.z0), rampB = Math.atan2(DECK.d3 - DECK.d2, RAMPS.b.z1 - RAMPS.b.z0);
  const lenA = Math.hypot(RAMPS.a.z1 - RAMPS.a.z0, DECK.d2 - DECK.d1), lenB = Math.hypot(RAMPS.b.z1 - RAMPS.b.z0, DECK.d3 - DECK.d2);
  const lights: [number, number, number][] = detail === 2 ? [[0, DECK.d1 + 3.5, 0], [0, DECK.d2 + 3.5, 0], [0, DECK.d3 + 3.5, 0]] : [[0, DECK.d1 + 3.5, -40], [0, DECK.d1 + 3.5, 40], [0, DECK.d2 + 3.5, -20], [0, DECK.d2 + 3.5, 25], [0, DECK.d3 + 3.5, -30], [0, DECK.d3 + 3.5, 30]];
  const beamItems = useMemo<Item[]>(() => Array.from({ length: 22 }, (_, i) => [(i % 2 ? 1 : -1) * (INNER.x - 1.5), DECK.d3 + 2.2, -42 + i * 4.2 + (i % 2) * 1.4, 0, 1] as Item), []);

  return (
    <group>
      <ambientLight intensity={0.5} />
      {/* decks: plank floors, the ceiling of one is the floor of the next */}
      {decks.map((d) => (
        <mesh key={d.id} position={[0, d.y - 0.14, (d.z0 + d.z1) / 2]}><boxGeometry args={[2 * INNER.x, 0.28, d.z1 - d.z0]} /><Mat map={floorTex} c="#c2a47c" /></mesh>
      ))}
      {/* inner walls, lighter than the pitch outside */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * (INNER.x + 0.01), H / 2, 0]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[2 * INNER.z, H]} /><Mat map={wallTex} c="#b79a74" side={DoubleSide} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={s} position={[0, H / 2, s * (INNER.z + 0.01)]}><planeGeometry args={[2 * INNER.x, H]} /><Mat map={wallTex} c="#b79a74" side={DoubleSide} /></mesh>)}
      <Instances items={built.ribs}><boxGeometry args={[0.4, 4.2, 0.4]} /><Mat map={pitch} r={0.7} /></Instances>
      <Instances items={built.beams}><boxGeometry args={[2 * INNER.x, 0.3, 0.35]} /><Mat map={pitch} r={0.7} /></Instances>
      {/* the stalls ("aposentos", Gn 6:14): slatted fronts, rails, partitions and straw */}
      <Instances items={built.slats}><boxGeometry args={[0.08, 2.6, 0.08]} /><Mat c="#7a5c3a" /></Instances>
      <Instances items={built.rail19}><boxGeometry args={[0.1, 0.1, 19]} /><Mat c="#6a4d33" /></Instances>
      <Instances items={built.rail28}><boxGeometry args={[0.1, 0.1, 28]} /><Mat c="#6a4d33" /></Instances>
      <Instances items={built.partitions}><boxGeometry args={[INNER.x - CORRIDOR - 0.3, 2.6, 0.12]} /><Mat map={wallTex} c="#a88a63" /></Instances>
      <Instances items={built.hay19}><boxGeometry args={[INNER.x - CORRIDOR - 0.3, 0.14, 19]} /><Mat map={hayTex} c="#d9c27c" r={1} /></Instances>
      <Instances items={built.hay28}><boxGeometry args={[INNER.x - CORRIDOR - 0.3, 0.14, 28]} /><Mat map={hayTex} c="#d9c27c" r={1} /></Instances>
      {(Object.keys(built.animals) as AnimalKind[]).map((k) => <Animals key={k} kind={k} items={built.animals[k]} />)}
      {/* the granary (Gn 6:21): sacks, jars, bales and barrels of every food */}
      <Instances items={built.sacks}><sphereGeometry args={[0.45, 7, 5]} /><Mat c="#c9b27c" r={1} /></Instances>
      <Instances items={built.jars}><cylinderGeometry args={[0.32, 0.26, 0.9, 8]} /><Mat c="#a8613a" r={0.8} /></Instances>
      <Instances items={built.bales}><boxGeometry args={[1.0, 0.5, 0.55]} /><Mat map={hayTex} c="#d9c27c" r={1} /></Instances>
      <Instances items={built.barrels}><cylinderGeometry args={[0.42, 0.42, 1.1, 10]} /><Mat map={iron} c="#6a4d33" r={0.7} /></Instances>
      {/* cages and nests for the birds on the third deck */}
      <Instances items={built.cages}><boxGeometry args={[1.0, 0.9, 1.1]} /><meshStandardMaterial color="#8a6a45" wireframe /></Instances>

      {/* the ramps between the decks (the text does not say how: a reconstruction) */}
      <mesh position={[(RAMPS.a.x[0] + RAMPS.a.x[1]) / 2, (DECK.d1 + DECK.d2) / 2 - 0.12, (RAMPS.a.z0 + RAMPS.a.z1) / 2]} rotation={[rampA, 0, 0]}><boxGeometry args={[RAMPS.a.x[1] - RAMPS.a.x[0], 0.24, lenA]} /><Mat map={floorTex} c="#b0916a" /></mesh>
      <mesh position={[(RAMPS.b.x[0] + RAMPS.b.x[1]) / 2, (DECK.d2 + DECK.d3) / 2 - 0.12, (RAMPS.b.z0 + RAMPS.b.z1) / 2]} rotation={[-rampB, 0, 0]}><boxGeometry args={[RAMPS.b.x[1] - RAMPS.b.x[0], 0.24, lenB]} /><Mat map={floorTex} c="#b0916a" /></mesh>

      {/* the window band: light falls in from the top, along both sides (Gn 6:16) */}
      <Instances items={beamItems}><coneGeometry args={[1.6, 4.6, 8, 1, true]} /><meshBasicMaterial color="#fff1c8" transparent opacity={0.09} depthWrite={false} side={DoubleSide} /></Instances>
      {[-1, 1].map((s) => <mesh key={s} position={[s * (INNER.x - 0.05), H - 0.65, 0]}><boxGeometry args={[0.1, 0.45, 2 * INNER.z]} /><meshBasicMaterial color="#fff5d8" /></mesh>)}

      {/* lanterns along the aisles (a reconstruction: the text does not say how it was lit) */}
      {lights.map(([x, y, z]) => (
        <group key={`${y}${z}`} position={[x, y, z]}>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.02, 0.02, 1, 4]} /><Mat c="#3a3a3a" /></mesh>
          <mesh><boxGeometry args={[0.28, 0.34, 0.28]} /><meshStandardMaterial color="#5a4a2a" /></mesh>
          <Flame size={0.28} intensity={detail < 2 ? 7 : 3} position={[0, 0, 0]} />
        </group>
      ))}

      {/* the dove with the olive leaf (Gn 8:8-11), on a beam by the window of the third deck */}
      <group position={[-INNER.x + 0.8, DECK.d3 + 2.9, -39]}>
        <mesh position={[0, -0.2, 0]}><boxGeometry args={[0.3, 0.2, 1.4]} /><Mat c="#6a4d33" /></mesh>
        <Animals kind="bird" items={[[0, 0.0, 0, Math.PI / 2, 3.2]]} />
        <mesh position={[0.2, 0.55, 0.45]} rotation={[0.3, 0, 0.6]}><sphereGeometry args={[0.08, 6, 4]} /><meshStandardMaterial color="#6b8e3a" /></mesh>
      </group>
    </group>
  );
}

export const ARK_SCENES: Record<string, (p: { detail: Detail }) => React.JSX.Element> = { ark_outside: ArkExterior, ark_inside: ArkInterior };

