import { describe, expect, it } from "vitest";
import { parseTvtmsCondensed, toEnglish } from "@/lib/knowledge/versification";

const lines = [
  "SubdividedVerse\tPsa.51:Title\tPsa.51:1-2\tPsa.50:1-2\tPsa.50:1-2",
  "OneToOne\tPsa.51:1\tPsa.51:3\tPsa.50:3\tPsa.50:3",
  "OneToOne\tPsa.51:2-19\tPsa.51:4-21\tPsa.50:4-21\tPsa.50:4-21",
  "OneToOne\tGen.3:1\tGen.3:1\tGen.3:1\tGen.3:1",
  "TEST: If...\tGen.2:25=Last\tGen.2:25=Last",
];

describe("TVTMS condensed parser", () => {
  const map = parseTvtmsCondensed(lines);
  it("maps Hebrew psalm numbering to English", () => {
    expect(toEnglish(map, "heb", "PSA.51.3")).toBe("PSA.51.1");
    expect(toEnglish(map, "heb", "PSA.51.21")).toBe("PSA.51.19");
  });
  it("maps Latin/Greek psalm numbering to English", () => {
    expect(toEnglish(map, "lat", "PSA.50.4")).toBe("PSA.51.2");
  });
  it("keeps verses whose number does not change and skips titles", () => {
    expect(toEnglish(map, "heb", "GEN.3.1")).toBe("GEN.3.1");
    expect(map.some((r) => r.ref.includes("Title"))).toBe(false);
  });
});
