import { describe, expect, it } from "vitest";
import { modernizeCitations } from "@/lib/knowledge/old-citations";
import { findReferences } from "@/lib/knowledge/refs-parser";

const refs = (t: string) => findReferences(modernizeCitations(t), { strictCase: true }).flatMap((r) => r.refs);

describe("old-style citations", () => {
  it("reads Roman chapters followed by a period", () => {
    expect(refs("as in John iii. 16 and Rom. viii. 28")).toEqual(expect.arrayContaining(["JHN.3.16", "ROM.8.28"]));
  });
  it("reads upper-case book names and verse ranges", () => {
    expect(refs("--PSALM cxvi. 12-13. There")).toEqual(expect.arrayContaining(["PSA.116.12-PSA.116.13"]));
  });
  it("reads numbered books", () => {
    expect(refs("1 Cor. xiii. 4")).toContain("1CO.13.4");
    expect(refs("II Tim. iii. 16")).toContain("2TI.3.16");
  });
  it("leaves ordinary text alone", () => {
    expect(modernizeCitations("The war lasted six years. 12 men died.")).toBe("The war lasted six years. 12 men died.");
  });
});
