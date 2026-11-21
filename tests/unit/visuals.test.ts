import { describe, expect, it } from "vitest";
import { sanitizeVisuals, visualsCatalogPrompt } from "../../lib/visuals/catalog";
import { ROUTES } from "../../lib/visuals/route-data";
import { TIMELINES } from "../../lib/visuals/timeline-data";
import { dateLabel } from "../../components/visuals/TimelineView";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { expandRefs } from "../../lib/knowledge/refs-parser";

describe("route data", () => {
  it("has the 30 routes (11 of the MVP and 19 of Prompt 2.6) with unique ids and plausible Mediterranean coordinates", () => {
    expect(ROUTES).toHaveLength(30);
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(30);
    for (const r of ROUTES) {
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(3);
      expect(new Set(r.steps.map((s) => s.id)).size, r.id).toBe(r.steps.length);
      for (const s of r.steps) {
        expect(s.lat, s.id).toBeGreaterThan(5); expect(s.lat, s.id).toBeLessThan(52);
        expect(s.lon, s.id).toBeGreaterThan(-12); expect(s.lon, s.id).toBeLessThan(62);
        expect(s.refs.length, s.id).toBeGreaterThan(0);
        expect(s.note.length, s.id).toBeGreaterThan(10);
      }
    }
  });
  it("every verse reference is a real canonical reference", () => {
    for (const r of ROUTES) for (const s of r.steps) for (const ref of s.refs) {
      const [a] = ref.split("-");
      expect(/^[0-9A-Z]{3}\.\d+(\.\d+)?$/.test(a), `${r.id}/${s.id} ${ref}`).toBe(true);
      expect(expandRefs([ref]).length).toBeGreaterThan(0);
    }
    expect(findReferences("Atos 13:4").length).toBe(1);
  });
});

describe("timelines", () => {
  it("shows approximate dates with their uncertainty", () => {
    expect(dateLabel({ year: 30 })).toBe("c. 30 d.C.");
    expect(dateLabel({ year: 30, from: 30, to: 33 })).toBe("c. 30 d.C. a 33 d.C.");
    expect(dateLabel({ year: -5, from: -7, to: -4 })).toBe("c. 7 a.C. a 4 a.C.");
  });
  it("has the 15 timelines (6 of the MVP and 9 of Prompt 2.6), 8 of them for the Old Testament (D-07)", () => {
    expect(TIMELINES.map((t) => t.id).sort()).toEqual(["between_testaments", "bible_history", "david_solomon", "early_church", "exile_return", "exodus_wilderness", "jerusalem_history", "jesus_life", "judges", "kings", "nt_writings", "patriarchs", "paul_life", "prophets", "rome_judea"]);
    expect(TIMELINES.filter((t) => t.era === "ot")).toHaveLength(8);
    expect(TIMELINES.find((t) => t.id === "patriarchs")!.events.find((x) => x.id === "exodus")).toMatchObject({ year: -1446, to: -1260 });
  });
  it("events are in chronological order and ranges contain the year", () => {
    for (const t of TIMELINES) {
      const years = t.events.map((e) => e.year);
      expect([...years].sort((a, b) => a - b), t.id).toEqual(years);
      for (const e of t.events) if (e.from !== undefined && e.to !== undefined) { expect(e.from).toBeLessThanOrEqual(e.year); expect(e.to).toBeGreaterThanOrEqual(e.year); }
    }
  });
});

describe("visuals from the model", () => {
  it("lists the catalog for the prompt", () => {
    const p = visualsCatalogPrompt();
    expect(p).toContain("paul2: A 2ª viagem missionária de Paulo");
    expect(p).toContain("jesus_life");
  });
  it("drops unknown ids, keeps valid ones, trims places and limits to 2", () => {
    const out = sanitizeVisuals([
      { kind: "map", map_id: "paul2", highlight_place_ids: ["troas", "atlantis"] },
      { kind: "map", map_id: "narnia", highlight_place_ids: [] },
      { kind: "timeline", timeline_id: "early_church", focus_event_id: "council" },
      { kind: "timeline", timeline_id: "jesus_life", focus_event_id: "nope" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ map_id: "paul2", highlight_place_ids: ["troas"] });
    expect(out[1]).toMatchObject({ timeline_id: "early_church", focus_event_id: "council" });
  });
});
