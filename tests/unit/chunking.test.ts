import { describe, expect, it } from "vitest";
import { approxTokens, splitEntry } from "@/lib/knowledge/chunking";

describe("splitEntry", () => {
  it("keeps short entries as one chunk with the title first", () => {
    expect(splitEntry("Barnabas", "A Levite of Cyprus.")).toEqual(["Barnabas\nA Levite of Cyprus."]);
  });

  it("splits long entries into blocks under the token limit, with overlap and the title on each", () => {
    const body = Array.from({ length: 2000 }, (_, i) => `w${i}${i % 40 === 39 ? "." : ""}`).join(" ");
    const parts = splitEntry("Long", body);
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) {
      expect(p.startsWith("Long\n")).toBe(true);
      expect(approxTokens(p.split("\n")[1])).toBeLessThanOrEqual(700);
    }
    const lastWordsOfFirst = parts[0].split("\n")[1].split(" ").slice(-3);
    expect(parts[1]).toContain(lastWordsOfFirst[0]);
  });

  it("covers every word of the original text", () => {
    const body = Array.from({ length: 1500 }, (_, i) => `x${i}`).join(" ");
    const joined = splitEntry("T", body).join(" ");
    for (let i = 0; i < 1500; i += 97) expect(joined).toContain(`x${i}`);
  });
});
