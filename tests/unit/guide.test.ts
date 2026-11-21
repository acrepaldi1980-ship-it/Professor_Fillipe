import { describe, expect, it } from "vitest";
import { facing, lookingAt, sceneContext, currentZone } from "@/lib/immersive/guide";
import { TEST_PACKAGE as P } from "@/lib/immersive/packages/test";

describe("facing", () => {
  it("names the compass direction (-z is north, +x is east)", () => {
    expect(facing(0)).toBe("norte");
    expect(facing(-Math.PI / 2)).toBe("leste");
    expect(facing(Math.PI / 2)).toBe("oeste");
    expect(facing(Math.PI)).toBe("sul");
  });
});

describe("what the visitor sees", () => {
  it("lists the hotspots in front, nearest first, and not those behind", () => {
    expect(lookingAt(P, { env: P.id, x: 0, z: -22, yaw: 0 }).map((h) => h.id)).toEqual(["altar"]);
    expect(lookingAt(P, { env: P.id, x: 0, z: -22, yaw: Math.PI })).toEqual([]); // turned away
    expect(lookingAt(P, { env: P.id, x: 0, z: 9, yaw: 0 })).toEqual([]); // too far
  });
  it("finds the zone the visitor is in", () => {
    expect(currentZone(P, { env: P.id, x: 0, z: 8, yaw: 0 }).id).toBe("patio");
    expect(currentZone(P, { env: P.id, x: 0, z: -25, yaw: 0 }).id).toBe("altar");
  });
});

describe("scene context for the teacher", () => {
  it("tells where the student is, what is beside and in front, the station script and the sourced fact sheet", () => {
    const c = sceneContext(P, { env: P.id, x: 0, z: -26, yaw: 0, hotspot: "altar", station: 1 });
    expect(c.text).toContain("DENTRO de \"Pátio de teste\"");
    expect(c.text).toContain("zona \"Altar\"");
    expect(c.text).toContain("olhando para o norte");
    expect(c.text).toContain("ao lado de: \"O altar\"");
    expect(c.text).toContain("Estação do passeio guiado (2 de 2)");
    expect(c.text).toContain("Por que você acha que a ordem é essa?");
    expect(c.text).toContain("FICHA HISTÓRICA");
    expect(c.text).toContain("Êxodo 27:1-2");
    expect(c.text).toContain("reconstrução");
    expect(c.text).toContain("RA-20");
  });
  it("asks the retrieval for real first verses of the hotspot and station", () => {
    const c = sceneContext(P, { env: P.id, x: 0, z: -26, yaw: 0, hotspot: "altar", station: 1 });
    expect(c.refs).toContain("EXO.27.1");
    expect(c.refs.every((r) => /^[0-9A-Z]{3}\.\d+\.\d+$/.test(r))).toBe(true);
  });
  it("ignores a hotspot id that is not in the package (nothing from the client is trusted)", () => {
    const c = sceneContext(P, { env: P.id, x: 0, z: 0, yaw: 0, hotspot: "inventado" });
    expect(c.text).not.toContain("ao lado de");
    expect(c.text).not.toContain("inventado");
  });
});
