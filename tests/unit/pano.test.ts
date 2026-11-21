import { describe, expect, it } from "vitest";
import { PanoTour, angleBetween, dirFromAngles, lookedAt, panoContext, yawDiff } from "@/lib/immersive/pano";

const credit = { author: "Fulano", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:X.jpg" };
const base = {
  id: "teste", title: "Tour de teste", era: "Hoje", start: "entrada",
  sheet: { summary: "Resumo do lugar com fontes.", sources: ["Easton"] },
  scenes: [
    { id: "entrada", title: "Entrada", image: "/x.jpg", credit, links: [{ to: "patio", label: "Ir ao pátio", yaw: 90 }], hotspots: [{ id: "porta", label: "A porta", text: "Texto da porta aqui.", refs: ["JHN.10.9"], yaw: 10, pitch: 0 }] },
    { id: "patio", title: "Pátio", image: "/y.jpg", credit, links: [{ to: "entrada", label: "Voltar", yaw: -90 }] },
  ],
};

describe("pano tour schema", () => {
  it("accepts a valid tour and fills defaults", () => {
    const t = PanoTour.parse(base);
    expect(t.scenes[0].startYaw).toBe(0); expect(t.scenes[0].links[0].pitch).toBe(-12);
  });
  it("refuses unknown links, unknown start, duplicates and photos without credit", () => {
    expect(PanoTour.safeParse({ ...base, scenes: [{ ...base.scenes[0], links: [{ to: "zz", label: "x x", yaw: 0 }] }, base.scenes[1]] }).success).toBe(false);
    expect(PanoTour.safeParse({ ...base, start: "zz" }).success).toBe(false);
    expect(PanoTour.safeParse({ ...base, scenes: [base.scenes[0], base.scenes[0]] }).success).toBe(false);
    expect(PanoTour.safeParse({ ...base, scenes: [{ ...base.scenes[0], credit: undefined }, base.scenes[1]] }).success).toBe(false);
  });
});

describe("angles", () => {
  it("yaw 0 looks at -z and yaw 90 at +x", () => {
    expect(dirFromAngles(0, 0).map((n) => +n.toFixed(3))).toEqual([0, 0, -1]);
    expect(dirFromAngles(90, 0).map((n) => +n.toFixed(3))).toEqual([1, 0, -0]);
  });
  it("takes the short way around the circle", () => {
    expect(yawDiff(170, -170)).toBe(-20); expect(yawDiff(-170, 170)).toBe(20); expect(yawDiff(0, 180)).toBe(180);
  });
  it("angle between directions, also across the seam", () => {
    expect(angleBetween(179, 0, -179, 0)).toBeCloseTo(2); expect(angleBetween(0, 0, 0, 90)).toBeCloseTo(90);
  });
  it("picks the pin under the gaze, and none when looking elsewhere", () => {
    const pins = [{ id: "p", yaw: 100, pitch: 0 }, { id: "q", yaw: 108, pitch: 0 }];
    expect(lookedAt(pins, 104, 0, 14)?.id).toBeDefined();
    expect(lookedAt(pins, 99, 0, 14)?.id).toBe("p");
    expect(lookedAt(pins, -80, 0, 14)).toBeNull();
  });
});

describe("teacher context", () => {
  const tour = PanoTour.parse(base);
  it("names the place, the credit, what he looks at and where he can go; warns the photo is from today", () => {
    const c = panoContext(tour, { scene: "entrada", yaw: 12, pitch: 0 });
    expect(c.text).toContain("Entrada"); expect(c.text).toContain("CC BY-SA"); expect(c.text).toContain("A porta"); expect(c.text).toContain("Ir ao pátio"); expect(c.text).toContain("HOJE");
    expect(c.refs.length).toBeGreaterThan(0);
  });
  it("includes the sheet and RA-20", () => {
    const c = panoContext(tour, { scene: "patio" });
    expect(c.text).toContain("FICHA HISTÓRICA"); expect(c.text).toContain("RA-20");
  });
});

import { project } from "@/lib/immersive/pano";
describe("projection of pins on the screen", () => {
  it("what is straight ahead is at the center", () => {
    const p = project(30, 10, 30, 10, 70, 1.6)!;
    expect(p.x).toBeCloseTo(0.5); expect(p.y).toBeCloseTo(0.5);
  });
  it("what is to the right lands right of center, what is above lands above", () => {
    expect(project(20, 0, 0, 0, 70, 1.6)!.x).toBeGreaterThan(0.5);
    expect(project(-20, 0, 0, 0, 70, 1.6)!.x).toBeLessThan(0.5);
    expect(project(0, 15, 0, 0, 70, 1.6)!.y).toBeLessThan(0.5);
  });
  it("what is behind the viewer is not drawn, and the edge of the view is at the edge of the screen", () => {
    expect(project(180, 0, 0, 0, 70, 1.6)).toBeNull();
    expect(project(0, 35, 0, 0, 70, 1.6)!.y).toBeCloseTo(0, 1);
  });
  it("turning the camera moves the pin the opposite way", () => {
    const a = project(0, 0, 0, 0, 70, 1.6)!.x, b = project(0, 0, 20, 0, 70, 1.6)!.x;
    expect(b).toBeLessThan(a);
  });
});
