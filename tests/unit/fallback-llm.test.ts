import { beforeEach, describe, expect, it } from "vitest";
import { FallbackLlm, primaryIsDown, resetPrimaryDown } from "../../lib/teacher/fallback-llm";

const ok = (v: string) => ({ generate: async () => v });
const fail = (m: string) => ({ generate: async () => { throw new Error(m); } });
const args = { system: "", messages: [], tier: "fast" as const };

describe("FallbackLlm", () => {
  beforeEach(() => resetPrimaryDown());
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
  it("after a no-credit answer the main model is skipped for a while (no failing call before every turn)", async () => {
    let primaryCalls = 0;
    const primary = { generate: async () => { primaryCalls++; throw new Error("400 Your credit balance is too low to access the API"); } };
    await new FallbackLlm(primary, ok("groq")).generate(args);
    expect(primaryIsDown()).toBe(true);
    expect(await new FallbackLlm(primary, ok("groq")).generate(args)).toBe("groq");
    expect(primaryCalls).toBe(1);
  });
  it("reports why the main model was skipped (diagnostics)", async () => {
    const f = new FallbackLlm(fail("400 credit balance too low"), ok("groq"));
    await f.generate(args);
    expect(f.info().log.join(" ")).toContain("credit balance");
  });
});
