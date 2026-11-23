import { describe, expect, it } from "vitest";
import { composePersonalPath, personalRequest } from "@/lib/paths/personal";
import { layerTrail } from "@/lib/teacher/prompts";

const req = (o: object = {}) => personalRequest.parse({ goal: "know_jesus", ...o });

describe("personalised path (Module 2)", () => {
  it("has one review day every 7th day, with the day count asked for", () => {
    const p = composePersonalPath(req({ days: 30 }));
    expect(p.days.length).toBeGreaterThanOrEqual(28);
    p.days.forEach((d) => expect(d.kind === "review").toBe(d.day % 7 === 0));
  });
  it("does not repeat passages and does not put two readings of the same kind in a row", () => {
    const p = composePersonalPath(req({ days: 30, goal: "whole_bible" }));
    const refs = p.days.filter((d) => d.kind === "reading").map((d) => d.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });
  it("gives every reading day the daily prompts and a central verse", () => {
    for (const d of composePersonalPath(req()).days.filter((x) => x.kind === "reading")) {
      expect(d.question && d.action && d.prayer && d.key_verse).toBeTruthy();
    }
  });
  it("starts with a short, clear text when the level is low", () => {
    const p = composePersonalPath(req({ level: 1, minutes: 10 }));
    expect(p.days[0].ref).toMatch(/^(JHN|PSA|MAT|ROM|PHP|EPH)/);
  });
  it("adds the role's weekly deliverable", () => {
    expect(composePersonalPath(req({ role: "pastor" })).weeks?.every((w) => w.extra === "sermon_outline")).toBe(true);
    expect(composePersonalPath(req({ role: "ebd_teacher" })).weeks?.every((w) => w.extra === "lesson_outline")).toBe(true);
    expect(composePersonalPath(req()).weeks?.every((w) => w.extra === "none")).toBe(true);
  });
  it("keeps what was done when recomposed on the weekly review, without repeating it", () => {
    const first = composePersonalPath(req());
    const kept = first.days.slice(0, 7);
    const again = composePersonalPath(req({ goal: "overcome" }), kept);
    expect(again.days.slice(0, 7).map((d) => d.ref)).toEqual(kept.map((d) => d.ref));
    expect(again.doneNumbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const readings = again.days.filter((d) => d.kind === "reading").map((d) => d.ref);
    expect(new Set(readings).size).toBe(readings.length);
  });
  it("makes the teacher lead the mirror, then the grace; review days are a conversation", () => {
    const p = composePersonalPath(req());
    const day = p.days[0], rev = p.days.find((d) => d.kind === "review")!;
    const lay = layerTrail({ trail: { path: p.title, ...day, total: p.days.length } });
    expect(lay).toMatch(/ESPELHO/); expect(lay).toMatch(/GRAÇA/); expect(lay).toContain(day.question!);
    const r = layerTrail({ trail: { path: p.title, ...rev, total: p.days.length } });
    expect(r).toMatch(/REVISÃO/); expect(r).toMatch(/não o culpe/);
  });
});
