// The New Jerusalem layout (docs/ambientes/nova-jerusalem.md): Apocalipse 21-22. The real city is a cube of 12,000 stadia (about 2,200 km) on each side: it cannot be
// walked, so the model is SYMBOLIC (a square of 300 m). Only the wall's height (144 cubits) keeps its measure. The wall has 12 gates (3 on each side, each a single pearl),
// 12 foundations of precious stones, a street of pure gold, the river of the water of life from the throne, and the tree of life on both banks. Orientation: the visitor
// arrives from the south (here +z) through the middle gate and walks north (-z) toward the throne.
import { c } from "./tabernaculo";
import type { Collider } from "./package";

const box = (x0: number, z0: number, x1: number, z1: number): Collider => ({ type: "box", min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)] });

export const CITY = { half: 150, wall: 3, wallH: c(144), gateW: 14, gateH: 24, gates: [-80, 0, 80] as number[] };
/** The foundation stones in the order of Ap 21:19-20, with a color for each (the colors are a reading of the names: reconstruction). */
export const STONES: { name: string; color: string }[] = [
  { name: "jaspe", color: "#8bbf7b" }, { name: "safira", color: "#2d4fa8" }, { name: "calcedônia", color: "#9ec8c0" }, { name: "esmeralda", color: "#1fae6a" },
  { name: "sardônica", color: "#c4745a" }, { name: "sárdio", color: "#b3202f" }, { name: "crisólito", color: "#c9c04a" }, { name: "berilo", color: "#6fc7a8" },
  { name: "topázio", color: "#e3c14a" }, { name: "crisópraso", color: "#7fd08a" }, { name: "jacinto", color: "#e08a3c" }, { name: "ametista", color: "#8b4aa8" },
];
export const TRIBES = ["Rúben", "Simeão", "Levi", "Judá", "Dã", "Naftali", "Gade", "Aser", "Issacar", "Zebulom", "José", "Benjamim"];
export const THRONE = { at: [0, -42] as [number, number], r: 13 };
export const RIVER = { halfW: 4.5, z0: THRONE.at[1] + THRONE.r + 3, z1: 118, bridges: [25, 60, 95], bridgeHalf: 4.5 };
export const TREES_Z = Array.from({ length: 12 }, (_, i) => 108 - i * 11); // along both banks

export function wallColliders(): Collider[] {
  const h = CITY.half, t = CITY.wall, g = CITY.gateW / 2, out: Collider[] = [];
  const edges = [-h - t, ...CITY.gates.flatMap((x) => [x - g, x + g]), h + t];
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i], b = edges[i + 1];
    out.push(box(a, h, b, h + t), box(a, -h - t, b, -h), box(h, a, h + t, b), box(-h - t, a, -h, b));
  }
  return out;
}
export function cityColliders(): Collider[] {
  const out: Collider[] = [{ type: "circle", c: THRONE.at, r: THRONE.r }];
  const cuts = [RIVER.z0, ...RIVER.bridges.flatMap((z) => [z - RIVER.bridgeHalf, z + RIVER.bridgeHalf]), RIVER.z1];
  for (let i = 0; i < cuts.length; i += 2) out.push(box(-RIVER.halfW, cuts[i], RIVER.halfW, cuts[i + 1]));
  for (const z of TREES_Z) for (const s of [-1, 1]) out.push({ type: "circle", c: [s * 11, z], r: 0.7 });
  return out;
}
