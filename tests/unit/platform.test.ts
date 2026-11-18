import { describe, expect, it } from "vitest";
import { getPlatform, setPlatformForTests, type Platform } from "@/lib/platform";

describe("getPlatform", () => {
  it("returns an injected platform (mock) for tests", () => {
    const fake = { name: "web", microphone: {}, audioPlayer: {} } as unknown as Platform;
    setPlatformForTests(fake);
    expect(getPlatform()).toBe(fake);
    setPlatformForTests(null);
  });
});
