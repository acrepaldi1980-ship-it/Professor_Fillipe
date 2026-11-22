import { describe, expect, it } from "vitest";
import { EnvironmentPackage } from "@/lib/immersive/package";
import { activeZones, collidersOf, detailFor, hits, keysToStick, move, nearestHotspot, spawnIsFree, stickFromOffset, worldDirection, yawToward, type V2 } from "@/lib/immersive/movement";
import { TEST_PACKAGE } from "@/lib/immersive/packages/test";

const B = { min: [-50, -50] as V2, max: [50, 50] as V2 };
const wall = { type: "box" as const, min: [-5, -1] as V2, max: [5, 1] as V2 };

describe("collision", () => {
  it("detects a circle against a box and a circle", () => {
    expect(hits([0, 1.4], 0.35, wall)).toBe(false);
    expect(hits([0, 1.3], 0.35, wall)).toBe(true);
    expect(hits([6, 0], 0.35, wall)).toBe(false);
    expect(hits([0.8, 0], 0.35, { type: "circle", c: [0, 0], r: 0.5 })).toBe(true);
  });
  it("stops at a wall and slides along it", () => {
    const p = move([0, 3], [0.5, -4], 0.35, [wall], B); // diagonal into the wall from the north
    expect(p[1]).toBeGreaterThanOrEqual(1.35 - 1e-6); // did not enter
    expect(p[0]).toBeGreaterThan(0.4); // kept the sideways part
  });
  it("never jumps through a thin wall in one long step", () => {
    const thin = { type: "box" as const, min: [-5, -0.05] as V2, max: [5, 0.05] as V2 };
    const p = move([0, 2], [0, -6], 0.35, [thin], B);
    expect(p[1]).toBeGreaterThan(0.3);
  });
  it("cannot leave the walkable rectangle", () => {
    expect(move([49, 0], [10, 0], 0.35, [], B)[0]).toBeCloseTo(49.65, 5);
  });
});

describe("direction and input", () => {
  it("forward is -z at yaw 0 and turns with the yaw", () => {
    const f = worldDirection([0, 1], 0);
    expect(f[0]).toBeCloseTo(0); expect(f[1]).toBeCloseTo(-1);
    const r = worldDirection([1, 0], 0);
    expect(r[0]).toBeCloseTo(1); expect(r[1]).toBeCloseTo(0);
    const left = worldDirection([0, 1], Math.PI / 2); // facing -x
    expect(left[0]).toBeCloseTo(-1); expect(left[1]).toBeCloseTo(0);
  });
  it("yawToward makes forward point at the target", () => {
    const yaw = yawToward([0, 0], [10, -10]);
    const d = worldDirection([0, 1], yaw);
    expect(d[0]).toBeCloseTo(Math.SQRT1_2); expect(d[1]).toBeCloseTo(-Math.SQRT1_2);
  });
  it("keys: WASD and arrows, diagonal not faster", () => {
    expect(keysToStick(new Set(["w"]))).toEqual([0, 1]);
    expect(keysToStick(new Set(["arrowleft"]))).toEqual([-1, 0]);
    expect(keysToStick(new Set(["w", "d"]))[0]).toBeCloseTo(Math.SQRT1_2);
    expect(keysToStick(new Set(["w", "s"]))).toEqual([0, 0]);
  });
  it("joystick: dead zone, direction and full tilt", () => {
    expect(stickFromOffset(3, 2, 52)).toEqual([0, 0]);
    const up = stickFromOffset(0, -52, 52); // thumb dragged up = forward
    expect(up[0]).toBeCloseTo(0); expect(up[1]).toBeCloseTo(1);
    const half = stickFromOffset(26, 0, 52);
    expect(half[0]).toBeGreaterThan(0.3); expect(half[0]).toBeLessThan(0.7);
  });
});

describe("zones, detail and hotspots", () => {
  const p = TEST_PACKAGE;
  it("loads only the zones near the visitor, with hysteresis", () => {
    const at = (x: number, z: number, cur: string[] = []) => [...activeZones(p.zones, [x, z], new Set(cur))].sort();
    expect(at(0, 9)).toEqual(["patio"]);
    expect(at(0, -23)).toEqual(["altar", "patio"]);
    expect(at(0, -26, ["patio", "altar"])).toEqual(["altar", "patio"]);
    expect(at(0, -40, ["patio", "altar"])).toEqual(["altar"]); // patio center is 40 m away: past unload (34)
    expect(at(0, 33, [])).toEqual([]); // nothing in range
  });
  it("collects colliders only from built zones", () => {
    expect(collidersOf(p.zones, new Set(["patio"])).length).toBe(7);
    expect(collidersOf(p.zones, new Set(["altar"])).length).toBe(1);
  });
  it("level of detail drops with distance", () => {
    expect([detailFor(5), detailFor(20), detailFor(50)]).toEqual([0, 1, 2]);
  });
  it("finds the nearest hotspot in range, only in built zones", () => {
    expect(nearestHotspot(p.hotspots, [0, -27], new Set(["altar"]))?.id).toBe("altar");
    expect(nearestHotspot(p.hotspots, [0, -27], new Set(["patio"]))).toBeNull();
    expect(nearestHotspot(p.hotspots, [0, 9], new Set(["patio", "altar"]))).toBeNull();
  });
});

describe("environment package", () => {
  it("the test package is valid and its start is free", () => {
    expect(TEST_PACKAGE.zones.length).toBe(2);
    expect(spawnIsFree(TEST_PACKAGE)).toBe(true);
    for (const s of TEST_PACKAGE.stations) expect(spawnIsFree({ ...TEST_PACKAGE, spawn: s.at })).toBe(true);
  });
  const base = { id: "x_env", title: "Ambiente", era: "x", spawn: [0, 0], bounds: { min: [-5, -5], max: [5, 5] }, sheet: { summary: "Um resumo com mais de vinte letras.", sources: ["fonte"] } };
  const zone = { id: "z1", name: "Zona", scene: "sc", center: [0, 0], load: 5, unload: 8 };
  it("rejects a hotspot in an unknown zone, a bad reference and an unload not greater than load", () => {
    expect(EnvironmentPackage.safeParse({ ...base, zones: [zone], hotspots: [{ id: "h1", zone: "nope", label: "Ponto", text: "Um texto qualquer.", at: [0, 0, 0] }] }).success).toBe(false);
    expect(EnvironmentPackage.safeParse({ ...base, zones: [zone], hotspots: [{ id: "h1", zone: "z1", label: "Ponto", text: "Um texto qualquer.", at: [0, 0, 0], refs: ["João 3:16"] }] }).success).toBe(false);
    expect(EnvironmentPackage.safeParse({ ...base, zones: [{ ...zone, unload: 5 }] }).success).toBe(false);
    expect(EnvironmentPackage.safeParse({ ...base, zones: [zone] }).success).toBe(true);
  });
  it("requires the historical sheet with at least one source (RA-09)", () => {
    expect(EnvironmentPackage.safeParse({ ...base, zones: [zone], sheet: { summary: "Um resumo com mais de vinte letras.", sources: [] } }).success).toBe(false);
  });
});

import { floorAt, floorHeight } from "@/lib/immersive/movement";
describe("floors, decks and ramps", () => {
  const floors = [
    { id: "ground", min: [-50, -50] as [number, number], max: [50, 50] as [number, number], y0: 0, y1: 0, axis: "z" as const },
    { id: "deck2", min: [-10, -50] as [number, number], max: [10, 40] as [number, number], y0: 4.5, y1: 4.5, axis: "z" as const },
    { id: "ramp", min: [-9, 40] as [number, number], max: [-5, 50] as [number, number], y0: 4.5, y1: 9, axis: "z" as const },
  ];
  it("a ramp rises along its axis, a deck is flat", () => {
    expect(floorHeight(floors[2], [-7, 40])).toBeCloseTo(4.5); expect(floorHeight(floors[2], [-7, 45])).toBeCloseTo(6.75); expect(floorHeight(floors[2], [-7, 50])).toBeCloseTo(9);
    expect(floorHeight(floors[1], [0, 0])).toBe(4.5);
  });
  it("stacked floors: he stands on the highest one he can step up to (a deck overhead is out of reach)", () => {
    expect(floorAt(floors, [0, 0], 0).id).toBe("ground");
    expect(floorAt(floors, [0, 0], 4.5).id).toBe("deck2");
    expect(floorAt(floors, [0, 0], 3).id).toBe("ground"); // between the two: he drops to the floor below
    expect(floorAt(floors, [0, 0], 4).id).toBe("deck2"); // within a step of the deck: up
  });
  it("walking up a ramp keeps following it", () => {
    let y = 4.5;
    for (let z = 41; z <= 50; z += 0.5) { const f = floorAt(floors, [-7, z], y); expect(f.id).toBe("ramp"); y = f.y; }
    expect(y).toBeCloseTo(9);
  });
  it("without floors the height is 0 and nothing changes", () => { expect(floorAt([], [3, 3], 0)).toEqual({ id: null, y: 0 }); });
});
