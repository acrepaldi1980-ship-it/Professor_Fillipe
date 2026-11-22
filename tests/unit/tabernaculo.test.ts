import { describe, expect, it } from "vitest";
import { ALTAR, ARK, COURT, CUBIT, LAVER, TENT, VEIL_Z, courtColliders, courtPosts, tentColliders, tentWest, zOf } from "@/lib/immersive/tabernaculo";
import { hits, move } from "@/lib/immersive/movement";

describe("Tabernacle layout (Êxodo 25-40)", () => {
  it("the courtyard is 100 x 50 cubits with 60 posts", () => {
    expect(COURT.halfL * 2).toBeCloseTo(100 * CUBIT); expect(COURT.halfW * 2).toBeCloseTo(50 * CUBIT); expect(courtPosts()).toHaveLength(60);
  });
  it("the altar is 5 x 5 x 3 cubits and the tent 30 x 10 x 10 cubits", () => {
    expect(ALTAR.side).toBeCloseTo(5 * CUBIT); expect(ALTAR.height).toBeCloseTo(3 * CUBIT);
    expect(TENT.length).toBeCloseTo(30 * CUBIT); expect(TENT.halfW * 2).toBeCloseTo(10 * CUBIT); expect(TENT.height).toBeCloseTo(10 * CUBIT);
  });
  it("the Most Holy Place is a 10-cubit cube behind the veil, and the Holy Place is 20 x 10", () => {
    expect(VEIL_Z() - tentWest()).toBeCloseTo(10 * CUBIT); expect(TENT.door - VEIL_Z()).toBeCloseTo(20 * CUBIT);
  });
  it("the order from east to west: gate, altar, laver, tent door, veil, ark", () => {
    expect(zOf(0)).toBeGreaterThan(ALTAR.at[1]); expect(ALTAR.at[1]).toBeGreaterThan(LAVER.at[1]); expect(LAVER.at[1]).toBeGreaterThan(TENT.door); expect(TENT.door).toBeGreaterThan(VEIL_Z()); expect(VEIL_Z()).toBeGreaterThan(ARK.at[1]);
  });
  it("the tent fits inside the courtyard", () => { expect(tentWest()).toBeGreaterThan(-COURT.halfL); });
  it("the visitor can walk gate to laver to the Holy Place, but not into the Most Holy Place, and not through the altar", () => {
    const all = [...courtColliders(), ...tentColliders()];
    const free = (x: number, z: number) => !all.some((k) => hits([x, z], 0.35, k));
    for (const [x, z] of [[0, 30], [0, 22], [0, 14], [1.8, 9], [1.8, 4.5], [1.8, 0], [0, -3], [0, -6], [0, -9], [0, -12]]) expect(free(x, z), `${x},${z}`).toBe(true);
    let p: [number, number] = [0, -12];
    for (let i = 0; i < 40; i++) p = move(p, [0, -0.2], 0.35, all, { min: [-13, -24], max: [13, 40] });
    expect(p[1]).toBeGreaterThan(VEIL_Z()); // walking west stops at the veil
    expect(free(0, ALTAR.at[1])).toBe(false);
    expect(free(-COURT.halfW, 0)).toBe(false); // the curtain wall
  });
});

import { TABERNACLE_PACKAGE as P } from "@/lib/immersive/packages/tabernaculo";
import { spawnIsFree, collidersOf } from "@/lib/immersive/movement";
describe("Tabernacle package", () => {
  it("starts outside the gate on free ground and every station is free to stand on", () => {
    expect(spawnIsFree(P)).toBe(true);
    const all = collidersOf(P.zones, new Set(P.zones.map((z) => z.id)));
    for (const s of P.stations) expect(all.some((k) => hits(s.at as [number, number], P.radius, k)), s.id).toBe(false);
  });
  it("every point says what it rests on, cites a verse, and God is never shown as a figure", () => {
    for (const h of P.hotspots) { expect(h.basis, h.id).toBeDefined(); expect(h.refs.length, h.id).toBeGreaterThan(0); }
    const text = JSON.stringify(P).toLowerCase();
    expect(text).not.toMatch(/rosto de (jesus|deus)/);
    expect(P.hotspots.find((h) => h.id === "pia")?.basis).toBe("reconstrucao");
    expect(P.hotspots.find((h) => h.id === "altar")?.basis).toBe("escritura");
  });
  it("the Ark can be seen but not reached, and the sheet admits what is reconstruction", () => {
    expect(P.sheet.uncertainty).toMatch(/reconstru/i);
    expect(P.hotspots.find((h) => h.id === "arca")?.text).toMatch(/sem entrar/);
  });
});
