import { describe, expect, it } from "vitest";
import { getPlatform, setPlatformForTests } from "@/lib/platform";
import { createMockPlatform } from "@/lib/platform/mock";

describe("platform layer", () => {
  it("returns an injected platform (mock) for tests", () => {
    const fake = createMockPlatform();
    setPlatformForTests(fake);
    expect(getPlatform()).toBe(fake);
    setPlatformForTests(null);
  });

  it("exposes every interface of spec 10.6.2", () => {
    const p = createMockPlatform();
    for (const k of ["microphone", "audioPlayer", "push", "store", "share", "files", "deepLinks", "purchases", "haptics", "statusBar"] as const) {
      expect(p[k]).toBeDefined();
    }
  });

  it("the local store round-trips values", async () => {
    const p = createMockPlatform();
    await p.store.set("k", { a: 1 });
    expect(await p.store.get("k")).toEqual({ a: 1 });
    await p.store.remove("k");
    expect(await p.store.get("k")).toBeNull();
  });

  it("purchases go through the platform (web checkout today, store purchase on native)", async () => {
    const p = createMockPlatform();
    await p.purchases.openCheckout("https://pay.test/c/1");
    expect(p.calls).toContain("purchases.openCheckout:https://pay.test/c/1");
  });
});
