import { describe, expect, it } from "vitest";
import { getOrCreateIllustration, normalizePrompt, promptHash, tagsOf } from "../../lib/visuals/illustrations";
import { applyRa20 } from "../../lib/visuals/ra20";
import { STYLE_PREFIX } from "../../lib/visuals/style";

describe("RA-20 filter for image prompts", () => {
  it("keeps ordinary scenes untouched", () => {
    expect(applyRa20("Fishermen casting nets on the Sea of Galilee at dawn")).toMatchObject({ ok: true, prompt: "Fishermen casting nets on the Sea of Galilee at dawn" });
  });
  it("shows Jesus only from behind or far away and removes any face request", () => {
    const r = applyRa20("Jesus teaching the crowd, close-up of his face smiling");
    expect(r.ok).toBe(true);
    expect(r.prompt).not.toMatch(/close-up|face smiling/i);
    expect(r.prompt).toMatch(/from behind|silhouette/i);
    expect(r.reason).toBe("jesus_from_behind");
    expect(applyRa20("Cristo no barco, retrato do rosto").prompt).not.toMatch(/retrato|rosto/i);
  });
  it("represents God the Father only as light", () => {
    const r = applyRa20("God the Father sitting on a throne with a beard");
    expect(r.prompt).toMatch(/golden light/);
    expect(r.prompt).not.toMatch(/beard|sitting|God the Father/i);
    expect(applyRa20("Deus Pai aparecendo no céu").prompt).toMatch(/light/);
  });
  it("refuses violence, nudity and mockery, and too-short prompts", () => {
    expect(applyRa20("a naked woman by the well").ok).toBe(false);
    expect(applyRa20("gory beheading of a prophet").ok).toBe(false);
    expect(applyRa20("caricature mocking Jesus").ok).toBe(false);
    expect(applyRa20("oi").ok).toBe(false);
  });
});

describe("cache key and library tags", () => {
  it("the same scene in different wording of case and punctuation has the same hash", () => {
    expect(promptHash("Fishermen, on the Sea of Galilee!")).toBe(promptHash("fishermen on the  sea of galilee"));
    expect(promptHash("a")).not.toBe(promptHash("b"));
    expect(normalizePrompt("Pão & Peixes!")).toBe("pão peixes");
    expect(tagsOf("Fishermen casting nets on the Sea of Galilee")).toContain("fishermen");
  });
});

// A tiny fake of the Supabase RPCs the service uses.
function fakeDb(store: Map<string, { alt: string }>, quota = { n: 0, limit: 3 }) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "api_illustration_get") { const r = store.get(args.p_hash as string); return { data: r ? [{ mime: "image/webp", image_b64: "x", alt: r.alt }] : [] }; }
      if (name === "api_illustration_library") return { data: [] };
      if (name === "api_illustration_quota") { if (quota.n >= (args.p_limit as number)) return { data: false }; quota.n++; return { data: true }; }
      if (name === "api_illustration_put") { store.set(args.p_hash as string, { alt: args.p_alt as string }); return { error: null }; }
      return { data: null };
    },
  } as never;
}
const provider = (calls: string[]) => ({ name: "fake", async generate(p: string) { calls.push(p); return { b64: "aGk=", mime: "image/webp" }; } });

describe("illustration service", () => {
  it("generates once with the fixed style, then serves from cache", async () => {
    const store = new Map(); const calls: string[] = [];
    const db = fakeDb(store);
    const a = await getOrCreateIllustration(db, { prompt: "Fishermen casting nets on the Sea of Galilee" }, { provider: provider(calls) });
    expect(a).toMatchObject({ status: "ok", cached: false });
    expect(calls[0].startsWith(STYLE_PREFIX)).toBe(true);
    const b = await getOrCreateIllustration(db, { prompt: "fishermen casting nets on the sea of galilee" }, { provider: provider(calls) });
    expect(b).toMatchObject({ status: "ok", cached: true });
    expect(calls).toHaveLength(1);
  });
  it("never calls the generator for a refused prompt", async () => {
    const calls: string[] = [];
    expect(await getOrCreateIllustration(fakeDb(new Map()), { prompt: "a naked man in the river" }, { provider: provider(calls) })).toEqual({ status: "refused" });
    expect(calls).toHaveLength(0);
  });
  it("stops at the daily limit and reports provider failures without crashing", async () => {
    const quota = { n: 0, limit: 1 }; const store = new Map();
    expect((await getOrCreateIllustration(fakeDb(store, quota), { prompt: "Shepherds near Bethlehem at night" }, { dailyLimit: 1, provider: provider([]) })).status).toBe("ok");
    expect(await getOrCreateIllustration(fakeDb(store, quota), { prompt: "The temple of Solomon at sunrise" }, { dailyLimit: 1, provider: provider([]) })).toEqual({ status: "limit" });
    const failing = { name: "x", async generate(): Promise<never> { throw new Error("image_failed_402"); } };
    expect(await getOrCreateIllustration(fakeDb(new Map()), { prompt: "Ruth gleaning in the fields" }, { provider: failing })).toEqual({ status: "unavailable" });
  });
});
