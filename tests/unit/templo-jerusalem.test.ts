import { describe, expect, it } from "vitest";
import { CUBIT } from "@/lib/immersive/tabernaculo";
import { TEMPLE, Z, PILLARS, ALTAR, SEA, CHERUB } from "@/lib/immersive/templo";
import { CITY, STONES, TRIBES, cityColliders, wallColliders } from "@/lib/immersive/jerusalem";
import { TEMPLE_PACKAGE as TP } from "@/lib/immersive/packages/templo";
import { JERUSALEM_PACKAGE as JP } from "@/lib/immersive/packages/jerusalem";
import { PUBLIC_PACKAGES } from "@/lib/immersive/registry";
import { collidersOf, hits, move, spawnIsFree, type V2 } from "@/lib/immersive/movement";
import type { EnvironmentPackage } from "@/lib/immersive/package";

const all = (p: EnvironmentPackage) => new Set(p.zones.map((z) => z.id));
function walk(p: EnvironmentPackage, from: V2, to: V2): V2 {
  const cols = collidersOf(p.zones, all(p)); let pos = from;
  for (let i = 0; i < 6000; i++) { const dx = to[0] - pos[0], dz = to[1] - pos[1], d = Math.hypot(dx, dz); if (d < 0.25) break; pos = move(pos, [(dx / d) * 0.12, (dz / d) * 0.12], p.radius, cols, p.bounds as { min: V2; max: V2 }); }
  return pos;
}
function checks(p: EnvironmentPackage) {
  expect(spawnIsFree(p)).toBe(true);
  for (const s of p.stations) expect(collidersOf(p.zones, all(p)).some((k) => hits(s.at as V2, p.radius, k)), `${p.id}/${s.id} stands inside something`).toBe(false);
  for (const h of p.hotspots) { expect(h.basis, h.id).toBeDefined(); expect(h.refs.length, h.id).toBeGreaterThan(0); }
  expect(p.stations.every((s) => s.script.trim().endsWith("?")), "RA-06: every script ends with a question").toBe(true);
}

describe("Solomon's temple (1 Reis 6-7)", () => {
  it("keeps the measures of the text", () => {
    expect(TEMPLE.halfIn * 2).toBeCloseTo(20 * CUBIT); expect(TEMPLE.height).toBeCloseTo(30 * CUBIT);
    expect(TEMPLE.holyL).toBeCloseTo(40 * CUBIT); expect(TEMPLE.debirL).toBeCloseTo(20 * CUBIT); expect(TEMPLE.porchD).toBeCloseTo(10 * CUBIT);
    expect(PILLARS.height).toBeCloseTo(18 * CUBIT); expect(ALTAR.side).toBeCloseTo(20 * CUBIT); expect(SEA.r * 2).toBeCloseTo(10 * CUBIT); expect(CHERUB.height).toBeCloseTo(10 * CUBIT);
    expect(Z.holyBack - Z.debirBack).toBeCloseTo(TEMPLE.partition + 20 * CUBIT);
  });
  it("is valid, stations and points make sense", () => { checks(TP); });
  it("the visitor walks from the gate to the Holy Place but never into the Most Holy Place", () => {
    let door: V2 = [...TP.spawn] as V2;
    for (const w of [[0, 46], [8, 36], [8, 4], [0, 3.5], [0, -10]] as V2[]) door = walk(TP, door, w); // around the altar
    expect(Math.hypot(door[0], door[1] + 10)).toBeLessThan(1);
    const inside = walk(TP, door, [0, Z.debirBack + 3]);
    expect(inside[1]).toBeGreaterThan(Z.holyBack - 0.1);
  });
  it("has twelve oxen worth of sea, ten lavers, and is offered", () => { expect(PUBLIC_PACKAGES.map((x) => x.id)).toContain("templo_de_salomao"); });
});

describe("The New Jerusalem (Apocalipse 21-22)", () => {
  it("has 12 gates, 12 foundations, 12 tribes and a wall of 144 cubits", () => {
    expect(CITY.gates.length * 4).toBe(12); expect(STONES.length).toBe(12); expect(TRIBES.length).toBe(12); expect(CITY.wallH).toBeCloseTo(144 * CUBIT);
    expect(wallColliders().length).toBe(16);
  });
  it("is valid, stations and points make sense", () => { checks(JP); expect(cityColliders().length).toBeGreaterThan(5); });
  it("the visitor enters by the middle gate and reaches the throne by the bridges, but cannot cross the wall or the river elsewhere", () => {
    const start = walk(JP, [...JP.spawn] as V2, [0, 130]);
    expect(Math.hypot(start[0], start[1] - 130)).toBeLessThan(1);
    const across = walk(JP, [-9, 40], [9, 40]); // straight over the river, between bridges
    expect(across[0]).toBeLessThan(0);
    const over = walk(JP, [-9, 60], [9, 60]); // on a bridge
    expect(over[0]).toBeGreaterThan(8);
    const wall = walk(JP, [-40, 200], [-40, 100]); // through the wall, away from a gate
    expect(wall[1]).toBeGreaterThan(CITY.half);
  });
  it("is offered", () => { expect(PUBLIC_PACKAGES.map((x) => x.id)).toContain("nova_jerusalem"); });
});
