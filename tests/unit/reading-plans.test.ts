import { describe, expect, it } from "vitest";
import { CATALOG, chapterCount, chaptersOf, customSchedule, distribute, NT_CODES, planStatus, todayIndex, totalVerses, versesIn } from "@/lib/reading/plans";

const flat = (s: { chapters: string[] }[]) => s.flatMap((d) => d.chapters);

describe("reading data", () => {
  it("knows the Bible's size", () => {
    expect(chaptersOf(["GEN"]).length).toBe(50);
    expect(chapterCount("PSA")).toBe(150);
    expect(versesIn("JHN.3")).toBe(36);
    expect(versesIn("PSA.23")).toBe(6);
    expect(totalVerses("JHN")).toBe(879);
  });
});

describe("plans", () => {
  it("every catalog plan reads each chapter once, in order, and has the days it says", () => {
    for (const p of CATALOG.filter((x) => x.key !== "psalms-proverbs-31")) {
      const s = p.build();
      expect(s.length, p.key).toBe(p.days);
      expect(s.every((d) => d.chapters.length > 0), `${p.key} has an empty day`).toBe(true);
      const all = flat(s);
      expect(new Set(all).size, p.key).toBe(all.length);
      expect(s.map((d) => d.day)).toEqual(Array.from({ length: p.days }, (_, i) => i + 1));
    }
    expect(flat(CATALOG.find((p) => p.key === "bible-1y")!.build()).length).toBe(1189);
    expect(flat(CATALOG.find((p) => p.key === "nt-90")!.build())).toEqual(chaptersOf(NT_CODES));
    expect(flat(CATALOG.find((p) => p.key === "gospels-30")!.build()).length).toBe(89);
  });
  it("days are balanced by verses, not by chapters", () => {
    const s = distribute(chaptersOf(["GEN"]), 10);
    const w = s.map((d) => d.chapters.reduce((a, c) => a + versesIn(c), 0));
    expect(Math.max(...w) / Math.min(...w)).toBeLessThan(1.6);
    // a single long chapter (Psalm 119, 176 verses) is never cut
    expect(distribute(chaptersOf(["PSA"]), 30).some((d) => d.chapters.includes("PSA.119"))).toBe(true);
  });
  it("psalms and proverbs: 5 psalms and a proverb each day, all 150 + 31, the last day only Proverbs", () => {
    const s = CATALOG.find((p) => p.key === "psalms-proverbs-31")!.build();
    expect(s.length).toBe(31);
    expect(new Set(flat(s)).size).toBe(181);
    expect(s[0].chapters).toEqual(["PSA.1", "PSA.31", "PSA.61", "PSA.91", "PSA.121", "PRO.1"]);
    expect(s[30].chapters).toEqual(["PRO.31"]);
  });
  it("custom plan: from one book to another in some days", () => {
    const s = customSchedule("MAT", "JHN", 20)!;
    expect(s.length).toBe(20);
    expect(flat(s).length).toBe(89);
    expect(customSchedule("JHN", "MAT", 10)).toBeNull();
    expect(customSchedule("RUT", "RUT", 100)!.length).toBe(4);
  });
  it("shows today, the days behind and the next day to read", () => {
    const s = distribute(chaptersOf(["MRK"]), 10);
    expect(todayIndex("2026-11-01", new Date("2026-11-01T12:00:00"))).toBe(1);
    expect(todayIndex("2026-11-01", new Date("2026-10-30T12:00:00"))).toBeLessThanOrEqual(0);
    const st = planStatus(s, [1, 2, 4], "2026-11-01", new Date("2026-11-06T09:00:00"));
    expect(st).toMatchObject({ today: 6, done: 3, behind: 2, nextDay: 3, finished: false, percent: 30 });
    expect(planStatus(s, s.map((d) => d.day), "2026-11-01", new Date("2026-11-30")).finished).toBe(true);
  });
});
