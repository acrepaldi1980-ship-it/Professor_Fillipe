import { describe, expect, it } from "vitest";
import { ESCHATOLOGY } from "@/lib/eschatology/data";
import { eschatologyRecords } from "@/lib/appcontent/collect";

describe("eschatology content", () => {
  it("has unique ids, sources and valid Bible references", () => {
    expect(new Set(ESCHATOLOGY.map((e) => e.id)).size).toBe(ESCHATOLOGY.length);
    for (const e of ESCHATOLOGY) {
      expect(e.sources.length, e.id).toBeGreaterThan(3);
      expect(e.refs.length, e.id).toBeGreaterThan(0);
      for (const r of e.refs) expect(r, `${e.id} ${r}`).toMatch(/^[0-9A-Z]{3}\.\d+(\.\d+)?(-\d+(\.\d+)?)?$/);
    }
  });
  it("covers the disputed points with several readings (RA-14)", () => {
    const t = ESCHATOLOGY.map((e) => e.text).join(" ");
    for (const w of ["Amilenismo", "Pós-milenismo", "Pré-milenismo", "Pré-tribulacionismo", "Preterista", "aniquilacionismo"]) expect(t).toContain(w);
  });
  it("is indexed as app content with the ids the search uses", () => {
    const r = eschatologyRecords();
    expect(r.length).toBe(ESCHATOLOGY.length);
    expect(r[0].id).toMatch(/^app:escatologia:/);
    expect(r.every((x) => x.refs.length > 0)).toBe(true);
  });
});
