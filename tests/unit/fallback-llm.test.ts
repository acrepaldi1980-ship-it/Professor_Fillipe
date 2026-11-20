import { describe, expect, it } from "vitest";
import { FallbackLlm } from "../../lib/teacher/fallback-llm";

const ok = (v: string) => ({ generate: async () => v });
const fail = (m: string) => ({ generate: async () => { throw new Error(m); } });
const args = { system: "", messages: [], tier: "fast" as const };

describe("FallbackLlm", () => {
  it("uses the primary when it works", async () => {
    expect(await new FallbackLlm(ok("claude"), ok("groq")).generate(args)).toBe("claude");
  });
  it("falls back when the primary has no credit or is overloaded", async () => {
    expect(await new FallbackLlm(fail("400 Your credit balance is too low"), ok("groq")).generate(args)).toBe("groq");
    expect(await new FallbackLlm(fail("529 overloaded"), ok("groq")).generate(args)).toBe("groq");
  });
  it("does not hide other errors", async () => {
    await expect(new FallbackLlm(fail("invalid tool schema"), ok("groq")).generate(args)).rejects.toThrow("invalid tool schema");
  });
});
