// Solomon's temple layout (docs/ambientes/templo-de-salomao.md): measures from 1 Reis 6-7 and 2 Crônicas 3-4, in cubits (the cubit lives in tabernaculo.ts).
// The visitor enters from the east (here +z) and walks toward the Most Holy Place (-z). z = 0 is the front of the porch. What the text does not size
// (the courts, the wall thickness, the steps, the platform) is reconstruction and is marked as such in the package.
import { c } from "./tabernaculo";
import type { Collider } from "./package";

export { CUBIT } from "./tabernaculo";
const box = (x0: number, z0: number, x1: number, z1: number): Collider => ({ type: "box", min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)] });

export const TEMPLE = {
  halfIn: c(10), // 20 cubits wide inside (1 Rs 6:2)
  wall: 1.5, // reconstruction
  height: c(30), // 1 Rs 6:2
  porchD: c(10), // 1 Rs 6:3
  holyL: c(40), // 1 Rs 6:17
  debirL: c(20), // 1 Rs 6:20: a cube of 20 cubits
  partition: 0.9,
};
const T = TEMPLE;
/** z of each part (the front of the porch is 0; the temple goes to -z). */
export const Z = {
  porchFront: 0,
  doorWall: [-T.porchD - T.wall, -T.porchD] as [number, number],
  holyFront: -T.porchD - T.wall,
  holyBack: -T.porchD - T.wall - T.holyL,
  debirFront: -T.porchD - T.wall - T.holyL - T.partition,
  debirBack: -T.porchD - T.wall - T.holyL - T.partition - T.debirL,
  end: -T.porchD - T.wall - T.holyL - T.partition - T.debirL - T.wall,
};
export const OUTER = T.halfIn + T.wall; // outer face of the side walls
export const CHAMBERS = [c(5), c(6), c(7)]; // 1 Rs 6:6: three stories, 5, 6 and 7 cubits wide
export const PILLARS = { x: c(7.5), z: 1.3, r: 0.86, height: c(18), capital: c(5) }; // 1 Rs 7:15-16, 12 cubits around = r 0.86 m
export const ALTAR = { at: [0, 18] as [number, number], side: c(20), height: c(10) }; // 2 Cr 4:1
export const SEA = { at: [17, 6] as [number, number], r: c(5), height: c(5) }; // 1 Rs 7:23-26, 10 cubits across
export const LAVER_X = 11.5;
export const LAVER_Z = [-14, -8, -2, 4, 10]; // five on each side (1 Rs 7:39)
export const INNER_COURT = { halfW: 26, z0: Z.end - 6, z1: 46, gate: 4 };
export const OUTER_COURT = { halfW: 58, z0: Z.end - 14, z1: 84, gate: 5 };
export const CHERUB = { height: c(10), wing: c(5) }; // 1 Rs 6:23-27

export function templeColliders(): Collider[] {
  const o = OUTER, ch = CHAMBERS[0];
  const out: Collider[] = [
    box(-o, Z.end, -T.halfIn, 0), box(T.halfIn, Z.end, o, 0), // side walls (the porch has the same walls)
    box(-o, Z.end, o, Z.debirBack), // back wall
    box(-o, Z.doorWall[0], -1.7, Z.doorWall[1]), box(1.7, Z.doorWall[0], o, Z.doorWall[1]), // front wall, doorway between
    box(-o, Z.debirFront, o, Z.holyBack), // the partition closes the Most Holy Place: the visitor SEES it, never enters it (Lv 16:2; Hb 9:7)
    box(o, Z.end, o + ch, Z.doorWall[0]), box(-o - ch, Z.end, -o, Z.doorWall[0]), // the three stories of side rooms (not enterable)
  ];
  for (const s of [-1, 1]) out.push({ type: "circle", c: [s * PILLARS.x, PILLARS.z], r: PILLARS.r + 0.1 });
  return out;
}

export function courtColliders(): Collider[] {
  const t = 0.8, i = INNER_COURT, o = OUTER_COURT;
  const out: Collider[] = [
    box(-i.halfW - t, i.z0 - t, -i.halfW, i.z1), box(i.halfW, i.z0 - t, i.halfW + t, i.z1), box(-i.halfW - t, i.z0 - t, i.halfW + t, i.z0),
    box(-i.halfW - t, i.z1, -i.gate, i.z1 + t), box(i.gate, i.z1, i.halfW + t, i.z1 + t),
    box(-o.halfW - t, o.z0 - t, -o.halfW, o.z1 + t), box(o.halfW, o.z0 - t, o.halfW + t, o.z1 + t), box(-o.halfW - t, o.z0 - t, o.halfW + t, o.z0),
    box(-o.halfW - t, o.z1, -o.gate, o.z1 + t), box(o.gate, o.z1, o.halfW + t, o.z1 + t),
    box(ALTAR.at[0] - ALTAR.side / 2, ALTAR.at[1] - ALTAR.side / 2, ALTAR.at[0] + ALTAR.side / 2, ALTAR.at[1] + ALTAR.side / 2),
    { type: "circle", c: SEA.at, r: SEA.r + 0.4 },
  ];
  for (const s of [-1, 1]) for (const z of LAVER_Z) out.push({ type: "circle", c: [s * LAVER_X, z], r: 1.2 });
  return out;
}
