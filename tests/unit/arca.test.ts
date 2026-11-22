import { describe, expect, it } from "vitest";
import { ARK, CUBIT, DECK, FLOORS, INNER, RAMPS, hullColliders, stallColliders } from "@/lib/immersive/arca";
import { ARK_PACKAGE as P } from "@/lib/immersive/packages/arca";
import { collidersOf, floorAt, floorHeight, hits, move, spawnIsFree, type V2 } from "@/lib/immersive/movement";

describe("Noah's ark (Gênesis 6:15-16)", () => {
  it("is 300 x 50 x 30 cubits, three decks of 10 cubits", () => {
    expect(ARK.halfL * 2).toBeCloseTo(300 * CUBIT); expect(ARK.halfW * 2).toBeCloseTo(50 * CUBIT); expect(ARK.height).toBeCloseTo(30 * CUBIT);
    expect(ARK.deckH).toBeCloseTo(10 * CUBIT);
    expect(DECK.d3 + ARK.deckH).toBeLessThanOrEqual(ARK.height + 1.5); // the third deck fits under the roof
  });
  it("starts outside on free ground, and every station and hotspot is on a floor that exists", () => {
    expect(spawnIsFree(P)).toBe(true);
    const ids = new Set(FLOORS.map((f) => f.id));
    const all = new Set(P.zones.map((z) => z.id));
    for (const s of P.stations) {
      expect(s.floor && ids.has(s.floor), s.id).toBe(true);
      expect(collidersOf(P.zones, all, s.floor).some((k) => hits(s.at as V2, P.radius, k)), `${s.id} stands inside something`).toBe(false);
    }
    for (const h of P.hotspots) { expect(h.floor && ids.has(h.floor), h.id).toBe(true); expect(h.basis, h.id).toBeDefined(); expect(h.refs.length, h.id).toBeGreaterThan(0); }
  });
  it("the visitor can walk from the spawn through the door, up the first ramp to the second deck and up the second ramp to the third deck", () => {
    const all = new Set(P.zones.map((z) => z.id));
    let pos: V2 = [...P.spawn] as V2, y = 0;
    const go = (to: V2) => {
      for (let i = 0; i < 4000; i++) {
        const dx = to[0] - pos[0], dz = to[1] - pos[1], d = Math.hypot(dx, dz);
        if (d < 0.25) return;
        const f = floorAt(P.floors, pos, y);
        const next = move(pos, [(dx / d) * 0.12, (dz / d) * 0.12], P.radius, collidersOf(P.zones, all, f.id), P.bounds as { min: V2; max: V2 });
        pos = next; y = floorAt(P.floors, pos, y).y;
      }
      throw new Error(`stuck at ${pos} going to ${to}`);
    };
    go([-20, 0]); go([-12, 0]); expect(y).toBeGreaterThan(0.9); // up the ramp and in at the door: the first deck
    go([0, 0]); go([0, 61]); go([-7, 61]); go([-7, 45]); // the corridor, to the first ramp, up it
    expect(y).toBeCloseTo(DECK.d2, 0);
    go([0, 45]); go([0, -61]); go([7, -61]); go([7, -46]); // the second deck's corridor, to the second ramp, up it
    expect(y).toBeCloseTo(DECK.d3, 0);
    go([0, -40]);
    expect(floorAt(P.floors, pos, y).id).toBe("deck3");
  });
  it("the door is open only at the ground level: the upper decks have a wall there", () => {
    const door = [-ARK.halfW - 0.2, 0] as V2;
    expect(hullColliders().some((c) => !c.floor && hits(door, 0.35, c))).toBe(false);
    expect(hullColliders().some((c) => c.floor === "deck2" && hits(door, 0.35, c))).toBe(true);
  });
  it("a hotspot of the deck above does not open from the deck below", async () => {
    const { nearestHotspot } = await import("@/lib/immersive/movement");
    const all = new Set(P.zones.map((z) => z.id));
    const pomba = P.hotspots.find((h) => h.id === "pomba")!;
    expect(nearestHotspot([pomba], [pomba.at[0], pomba.at[2]], all, "deck1")).toBeNull();
    expect(nearestHotspot([pomba], [pomba.at[0], pomba.at[2]], all, "deck3")?.id).toBe("pomba");
  });
  it("the ramps connect the decks they should", () => {
    expect(floorHeight(FLOORS.find((f) => f.id === "ramp_a")!, [-7, RAMPS.a.z1])).toBeCloseTo(DECK.d1);
    expect(floorHeight(FLOORS.find((f) => f.id === "ramp_a")!, [-7, RAMPS.a.z0])).toBeCloseTo(DECK.d2);
    expect(floorHeight(FLOORS.find((f) => f.id === "ramp_b")!, [7, RAMPS.b.z1])).toBeCloseTo(DECK.d3);
    expect(stallColliders().length).toBeGreaterThan(20); expect(INNER.x).toBeLessThan(ARK.halfW);
  });
});
