import { describe, expect, it } from "vitest";
import { COMFORT, panelModel, panelPose, snapTurn, teleportTarget } from "@/lib/immersive/vr";
import { collidersOf } from "@/lib/immersive/movement";
import { TEST_PACKAGE as P } from "@/lib/immersive/packages/test";

describe("snap turn (comfort)", () => {
  it("turns one step per flick and not again until the stick returns to the middle", () => {
    let st = { armed: true };
    let r = snapTurn(st, 0.9); st = r.state;
    expect(r.yawDelta).toBeCloseTo(-(30 * Math.PI) / 180);
    r = snapTurn(st, 0.95); st = r.state; // still held: no more turning
    expect(r.yawDelta).toBe(0);
    r = snapTurn(st, 0.1); st = r.state; // back to the middle: re-armed
    r = snapTurn(st, -0.9);
    expect(r.yawDelta).toBeCloseTo((30 * Math.PI) / 180);
  });
  it("ignores a small deflection (dead zone)", () => {
    expect(snapTurn({ armed: true }, 0.4).yawDelta).toBe(0);
  });
  it("30 degrees makes 12 flicks a full turn", () => {
    expect(COMFORT.snapDegrees * 12).toBe(360);
  });
});

describe("teleport", () => {
  const all = collidersOf(P.zones, new Set(["patio", "altar"]));
  it("lands on free ground inside the walkable area", () => {
    expect(teleportTarget(P, all, [0, 9], [3, 5])).toEqual([3, 5]);
  });
  it("refuses inside a collider, outside the area and too far", () => {
    expect(teleportTarget(P, all, [0, 9], [-6, -6])).toBeNull(); // a column
    expect(teleportTarget(P, all, [0, 9], [0, -29.9])).toBeNull(); // the altar block (and too far)
    expect(teleportTarget(P, all, [0, 9], [30, 5])).toBeNull(); // outside bounds
    expect(teleportTarget(P, all, [0, 9], [0, -15])).toBeNull(); // 24 m: farther than the limit
  });
});

describe("panel in front of the head", () => {
  it("is placed ahead of where the visitor looks, a bit below the eyes", () => {
    const a = panelPose([0, 1.6, 0], 0);
    expect(a.position[0]).toBeCloseTo(0); expect(a.position[2]).toBeCloseTo(-1.7); expect(a.position[1]).toBeCloseTo(1.45);
    const b = panelPose([2, 1.6, 2], -Math.PI / 2); // facing east (+x)
    expect(b.position[0]).toBeCloseTo(3.7); expect(b.position[2]).toBeCloseTo(2);
  });
});

describe("panel model (the same story as the screen)", () => {
  const L = { ask: "Perguntar", stop: "Parar", thinking: "Pensando...", close: "Fechar", prev: "Anterior", next: "Próxima", start: "Começar", listen: "Ouvir", sheet: "Ficha" };
  it("a hotspot shows its text, the verses and a close button", () => {
    const m = panelModel({ hotspot: { label: "O altar", text: "Texto", verses: [{ ref: "EXO.27.1", text: "Farás também altar..." }] }, hasTour: true }, L);
    expect(m.title).toBe("O altar"); expect(m.verses).toHaveLength(1); expect(m.buttons.map((b) => b.id)).toEqual(["close", "ask"]);
  });
  it("a station has previous (not on the first), listen, next (not on the last) and ask", () => {
    const first = panelModel({ station: { title: "A", script: "s", index: 0, total: 2 }, hasTour: true }, L);
    expect(first.buttons.map((b) => b.id)).toEqual(["listen", "next", "ask"]);
    const last = panelModel({ station: { title: "B", script: "s", index: 1, total: 2 }, hasTour: true }, L);
    expect(last.buttons.map((b) => b.id)).toEqual(["prev", "listen", "ask"]);
  });
  it("shows the thinking state, the teacher's answer, and the recording state of the mic", () => {
    expect(panelModel({ busy: true, hasTour: false }, L).body).toBe("Pensando...");
    expect(panelModel({ answer: { text: "Resposta" }, hasTour: false }, L).buttons.map((b) => b.id)).toEqual(["listen", "ask"]);
    expect(panelModel({ station: { title: "A", script: "s", index: 0, total: 1 }, recording: true, hasTour: true }, L).buttons.find((b) => b.id === "ask")?.label).toBe("Parar");
  });
  it("with nothing open it offers to start the tour and the fact sheet", () => {
    expect(panelModel({ hasTour: true }, L).buttons.map((b) => b.id)).toEqual(["next", "sheet", "ask"]);
    expect(panelModel({ hasTour: false }, L).buttons.map((b) => b.id)).toEqual(["sheet", "ask"]);
  });
});
