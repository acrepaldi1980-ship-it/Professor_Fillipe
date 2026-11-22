// Tabernacle layout (Prompt 3.2): every measure comes from docs/ambientes/tabernaculo.md (Êxodo 25-40, in cubits). The cubit is stored in ONE place:
// changing CUBIT (0.45 m proposed; 0.52 m is the other reading) recomputes the whole layout. Orientation: the visitor walks toward the WEST (-z);
// east is +z (the gate), north is +x (right), south is -x (left). Items the text does not size are marked as reconstruction in the package.
import type { Collider } from "./package";

export const CUBIT = 0.45;
export const c = (n: number) => n * CUBIT;

// Courtyard: 100 x 50 cubits, curtains 5 cubits high (Êx 27:9-18)
export const COURT = { halfW: c(25), halfL: c(50), height: c(5) };
/** z of a point `s` cubits west of the gate. */
export const zOf = (s: number) => COURT.halfL - c(s);
export const GATE = { half: c(10), pillars: [-c(10), -c(3.3333), c(3.3333), c(10)] as number[], opening: c(3.3333) };

/** The 60 courtyard posts: 20 south, 20 north, 10 west, 3 + 4 gate + 3 east (Êx 27:10-17). */
export function courtPosts(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 20; i++) { const z = -COURT.halfL + (i * 2 * COURT.halfL) / 19; out.push([-COURT.halfW, z], [COURT.halfW, z]); }
  for (let i = 0; i < 10; i++) out.push([-COURT.halfW + (i * 2 * COURT.halfW) / 9, -COURT.halfL]);
  for (const x of [-COURT.halfW, -c(20), -c(15)]) out.push([x, COURT.halfL]);
  for (const x of GATE.pillars) out.push([x, COURT.halfL]);
  for (const x of [c(15), c(20), COURT.halfW]) out.push([x, COURT.halfL]);
  return out;
}

export const ALTAR = { at: [0, zOf(30)] as [number, number], side: c(5), height: c(3) };
export const LAVER = { at: [0, zOf(50)] as [number, number], r: 0.7 };

// Tent: 30 x 10 cubits, 10 high, 20 boards per side, 6 at the back (+2 corners), 1.5 cubits each (Êx 26:15-25)
export const TENT = { door: zOf(62), length: c(30), halfW: c(5), height: c(10), board: c(1.5) };
export const tentWest = () => TENT.door - TENT.length;
export const tentCenterZ = () => TENT.door - TENT.length / 2;
export const VEIL_Z = () => TENT.door - c(20);
export const DOOR_PILLARS = [-2.1, -1.55, -1.0, 1.0, 2.1];
export const VEIL_PILLARS = [-2.0, -0.7, 0.7, 2.0];
export const TABLE = { at: [c(3.1), (TENT.door + VEIL_Z()) / 2] as [number, number], size: [c(1), c(2)] as [number, number], height: c(1.5) };
export const LAMPSTAND = { at: [-c(3.1), (TENT.door + VEIL_Z()) / 2] as [number, number], height: 1.5 };
export const INCENSE = { at: [0, VEIL_Z() + 0.9] as [number, number], size: c(1), height: c(2) };
export const ARK = { at: [0, tentWest() + c(5)] as [number, number], size: [c(2.5), c(1.5)] as [number, number], height: c(1.5) };

const box = (x0: number, z0: number, x1: number, z1: number): Collider => ({ type: "box", min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)] });

export function courtColliders(): Collider[] {
  const t = 0.15, hw = COURT.halfW, hl = COURT.halfL;
  return [
    box(-hw - t, -hl - t, -hw + t, hl + t), box(hw - t, -hl - t, hw + t, hl + t), box(-hw, -hl - t, hw, -hl + t),
    box(-hw, hl - t, -GATE.half, hl + t), box(GATE.half, hl - t, hw, hl + t),
    box(-GATE.half, hl - t, -GATE.opening, hl + t), box(GATE.opening, hl - t, GATE.half, hl + t),
    box(ALTAR.at[0] - ALTAR.side / 2, ALTAR.at[1] - ALTAR.side / 2, ALTAR.at[0] + ALTAR.side / 2, ALTAR.at[1] + ALTAR.side / 2),
    { type: "circle", c: LAVER.at, r: LAVER.r },
  ];
}
export function tentColliders(): Collider[] {
  const w = TENT.halfW + 0.3, west = tentWest();
  return [
    box(-w, west - 0.3, -TENT.halfW, TENT.door), box(TENT.halfW, west - 0.3, w, TENT.door), box(-w, west - 0.3, w, west),
    ...DOOR_PILLARS.map((x): Collider => ({ type: "circle", c: [x, TENT.door], r: 0.14 })),
    box(-TENT.halfW, VEIL_Z() - 0.2, TENT.halfW, VEIL_Z() + 0.2), // the veil: the Most Holy Place is seen, never entered
    box(TABLE.at[0] - TABLE.size[0] / 2, TABLE.at[1] - TABLE.size[1] / 2, TABLE.at[0] + TABLE.size[0] / 2, TABLE.at[1] + TABLE.size[1] / 2),
    { type: "circle", c: LAMPSTAND.at, r: 0.35 },
    box(INCENSE.at[0] - INCENSE.size / 2, INCENSE.at[1] - INCENSE.size / 2, INCENSE.at[0] + INCENSE.size / 2, INCENSE.at[1] + INCENSE.size / 2),
  ];
}
