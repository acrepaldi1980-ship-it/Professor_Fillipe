import { describe, expect, it } from "vitest";
import { topicRefs } from "@/lib/knowledge/topics";

describe("well-known passages", () => {
  it("finds Lucas 15 for the prodigal son question the owner asked", () => {
    expect(topicRefs("Me explique tudo sobre a parábola do filho pródigo")).toContain("LUK.15.11-LUK.15.32");
  });
  it("ignores accents and case", () => {
    expect(topicRefs("O BOM SAMARITANO")).toContain("LUK.10.25-LUK.10.37");
  });
  it("returns nothing for an unrelated question", () => {
    expect(topicRefs("Qual a capital da França?")).toEqual([]);
  });
});
