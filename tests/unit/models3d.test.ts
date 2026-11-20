import { describe, expect, it } from "vitest";
import { sanitizeVisuals } from "../../lib/visuals/catalog";
import { MODELS_3D } from "../../lib/visuals/models3d";

describe("3D catalog", () => {
  it("has the three P0 models with text alternative, note and hotspots with verses", () => {
    expect(MODELS_3D.map((m) => m.id)).toEqual(["ark_covenant", "tabernacle", "solomon_temple"]);
    for (const m of MODELS_3D) {
      expect(m.alt.length, m.id).toBeGreaterThan(60);
      expect(m.note.length, m.id).toBeGreaterThan(30);
      expect(new Set(m.hotspots.map((h) => h.id)).size, m.id).toBe(m.hotspots.length);
      for (const h of m.hotspots) {
        expect(h.refs.length, h.id).toBeGreaterThan(0);
        for (const r of h.refs) expect(/^[0-9A-Z]{3}\.\d+/.test(r), `${m.id}/${h.id} ${r}`).toBe(true);
      }
    }
  });
  it("only catalog models reach the screen", () => {
    const out = sanitizeVisuals([{ kind: "model3d", model_id: "ark_covenant" }, { kind: "model3d", model_id: "golden_calf" }]);
    expect(out).toEqual([{ kind: "model3d", model_id: "ark_covenant" }]);
  });
});
