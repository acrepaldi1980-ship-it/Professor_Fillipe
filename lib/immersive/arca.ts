// Noah's ark layout (docs/ambientes/arca-de-noe.md): measures from Gênesis 6:14-16 in cubits (the cubit lives in tabernaculo.ts, one place).
// The ark lies along z: the door is on the south side (-x) in the middle; the visitor walks on the ground, up the ramp, through three decks and two ramps.
import { CUBIT, c } from "./tabernaculo";
import type { Collider, Floor } from "./package";

export { CUBIT };
export const ARK = { halfL: c(150), halfW: c(25), height: c(30), wall: 0.5, deckH: c(10) };
/** Height of each deck floor above the ground (the first rests on the keel structure, 1 m up, so the door has a ramp). */
export const DECK = { d1: 1.0, d2: 1.0 + 4.2, d3: 1.0 + 8.4 };
export const INNER = { x: ARK.halfW - ARK.wall, z: ARK.halfL - ARK.wall };
export const DOOR = { halfW: 2, height: 5.2 };
export const RAMP_OUT = { fromX: -27, toX: -ARK.halfW }; // ground to the sill
export const CORRIDOR = 2.0; // half width of the central aisle

/** Cross aisles every so often between blocks of stalls. */
export const STALL_BLOCKS: [number, number][] = [[-60, -41], [-37, -18], [-14, -3], [3, 14], [18, 37], [41, 60]]; // the aisle at z = 0 lines up with the door

export const RAMPS = { a: { x: [-9, -5] as [number, number], z0: 46, z1: 62 }, b: { x: [5, 9] as [number, number], z0: -62, z1: -46.5 } };

export const FLOORS: Floor[] = [
  { id: "ground", min: [-300, -300], max: [300, 300], y0: 0, y1: 0, axis: "z" },
  { id: "ramp_out", min: [RAMP_OUT.fromX, -DOOR.halfW], max: [RAMP_OUT.toX, DOOR.halfW], y0: 0, y1: DECK.d1, axis: "x" },
  // the doorway through the thickness of the wall, at the height of the first deck
  { id: "sill", min: [RAMP_OUT.toX - 0.3, -DOOR.halfW], max: [-INNER.x + 0.8, DOOR.halfW], y0: DECK.d1, y1: DECK.d1, axis: "x" },
  { id: "deck1", min: [-INNER.x, -INNER.z], max: [INNER.x, INNER.z], y0: DECK.d1, y1: DECK.d1, axis: "z" },
  { id: "deck2", min: [-INNER.x, -INNER.z], max: [INNER.x, 47], y0: DECK.d2, y1: DECK.d2, axis: "z" },
  { id: "deck3", min: [-INNER.x, -47], max: [INNER.x, INNER.z], y0: DECK.d3, y1: DECK.d3, axis: "z" },
  // ramp A (bow end): from deck 1 up to deck 2; ramp B (stern end): from deck 2 up to deck 3
  { id: "ramp_a", min: [RAMPS.a.x[0], RAMPS.a.z0], max: [RAMPS.a.x[1], RAMPS.a.z1], y0: DECK.d2, y1: DECK.d1, axis: "z" },
  { id: "ramp_b", min: [RAMPS.b.x[0], RAMPS.b.z0], max: [RAMPS.b.x[1], RAMPS.b.z1], y0: DECK.d2, y1: DECK.d3, axis: "z" },
];

const box = (x0: number, z0: number, x1: number, z1: number, floor?: string): Collider => ({ type: "box", min: [Math.min(x0, x1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(z0, z1)], ...(floor ? { floor } : {}) });

/** The hull: walls on every floor (with the door gap open at the ground level only), the ends, and solid stall blocks per deck. */
export function hullColliders(): Collider[] {
  const w = ARK.halfW, l = ARK.halfL, t = 0.45;
  const out: Collider[] = [
    box(-w - t, -l - t, -w, -DOOR.halfW), box(-w - t, DOOR.halfW, -w, l + t), // south wall, door gap in the middle
    box(w, -l - t, w + t, l + t), // north wall
    box(-w - t, -l - t, w + t, -l), box(-w - t, l, w + t, l + t), // ends
  ];
  // the door gap is closed for the upper decks (they have no door)
  for (const f of ["deck2", "deck3", "ramp_a", "ramp_b"]) out.push(box(-w - t, -DOOR.halfW, -w, DOOR.halfW, f));
  return out;
}
export function stallColliders(): Collider[] {
  const out: Collider[] = [];
  for (const [f, rows] of [["deck1", STALL_BLOCKS], ["deck2", STALL_BLOCKS.slice(0, 5)], ["deck3", STALL_BLOCKS.slice(1)]] as [string, [number, number][]][])
    for (const [z0, z1] of rows) { out.push(box(CORRIDOR, z0, INNER.x - 0.3, z1, f)); out.push(box(-INNER.x + 0.3, z0, -CORRIDOR, z1, f)); }
  return out;
}
