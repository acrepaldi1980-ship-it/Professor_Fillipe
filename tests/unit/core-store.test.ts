import { describe, expect, it } from "vitest";
import type { ChunkRow, KnowledgeStore } from "@/lib/knowledge/db";
import { HybridStore, mergeRows, NeonCoreStore } from "@/lib/knowledge/core-store";

const row = (id: string, rrf: number, work = "bible_por_blivre_2018"): ChunkRow => ({ id, work_id: work, text: "t", title_path: id, refs: [], tradition: "general", kind: "bible_text", language: "pt", tokens: 10, rrf, signals: ["semantic"] });
const args = { embedding: [0.1], text: "davi", refs: [], perSignal: 12 };

function fakes(opts: { core?: ChunkRow[] | Error; sb?: ChunkRow[]; sbDelayMs?: number } = {}) {
  const calls = { core: [] as unknown[], sb: [] as unknown[], coreTitles: 0, sbTitles: 0 };
  const sb: KnowledgeStore = {
    async searchChunks(a) { calls.sb.push(a.workIds ?? null); if (opts.sbDelayMs) await new Promise((r) => setTimeout(r, opts.sbDelayMs)); return opts.sb ?? []; },
    async bibleVerses() { return []; },
    async titleChunks() { calls.sbTitles++; return [row("sb-title", 0.03)]; },
    async lensWorks() { return ["own_notes_pentecostal"]; },
  };
  const core = { async searchChunks(a: { workIds?: string[] | null }) { calls.core.push(a.workIds ?? null); if (opts.core instanceof Error) throw opts.core; return opts.core ?? []; }, async titleChunks() { calls.coreTitles++; if (opts.core instanceof Error) throw opts.core; return [row("core-title", 0.033)]; } } as unknown as NeonCoreStore;
  return { sb, core, calls };
}

describe("merging", () => {
  it("keeps each chunk once with its best score, highest first", () => {
    const m = mergeRows([[row("a", 0.01), row("b", 0.05)], [row("a", 0.04)]], 10);
    expect(m.map((r) => [r.id, r.rrf])).toEqual([["b", 0.05], ["a", 0.04]]);
    expect(mergeRows([[row("a", 3), row("b", 2), row("c", 1)]], 2).length).toBe(2);
  });
});

describe("HybridStore: core search on Neon, notes and the rest on Supabase", () => {
  it("without Neon configured, Supabase answers everything", async () => {
    const f = fakes({ sb: [row("x", 0.02)] });
    expect((await new HybridStore(f.sb, null).searchChunks(args)).map((r) => r.id)).toEqual(["x"]);
    expect(f.calls.core.length).toBe(0);
  });
  it("a general search asks Neon, and the published notes on Supabase (only those)", async () => {
    const f = fakes({ core: [row("c1", 0.05)], sb: [row("note", 0.04, "own_notes_pentecostal")] });
    const r = await new HybridStore(f.sb, f.core).searchChunks(args);
    expect(r.map((x) => x.id)).toEqual(["c1", "note"]);
    expect(f.calls.sb).toEqual([["own_notes_pentecostal"]]);
  });
  it("slow notes never delay the answer: after the short budget the core result goes out alone", async () => {
    const f = fakes({ core: [row("c1", 0.05)], sb: [row("note", 0.04)], sbDelayMs: 3000 });
    const t0 = Date.now();
    const r = await new HybridStore(f.sb, f.core).searchChunks(args);
    expect(r.map((x) => x.id)).toEqual(["c1"]);
    expect(Date.now() - t0).toBeLessThan(2000);
  }, 6000);
  it("a lens search over works that are not in the core goes to Supabase only", async () => {
    const f = fakes({ core: [row("never", 1)], sb: [row("note", 0.04)] });
    const r = await new HybridStore(f.sb, f.core).searchChunks({ ...args, workIds: ["own_notes_pentecostal"] });
    expect(r.map((x) => x.id)).toEqual(["note"]);
    expect(f.calls.core.length).toBe(0);
  });
  it("a mix of core and other works is split between the two", async () => {
    const f = fakes({ core: [row("c1", 0.05)], sb: [row("note", 0.04)] });
    await new HybridStore(f.sb, f.core).searchChunks({ ...args, workIds: ["easton_1897", "own_notes_pentecostal"] });
    expect(f.calls.core).toEqual([["easton_1897"]]);
    expect(f.calls.sb).toEqual([["own_notes_pentecostal"]]);
  });
  it("if Neon fails, Supabase answers the whole search (the old path)", async () => {
    const f = fakes({ core: new Error("neon down"), sb: [row("old", 0.03)] });
    const r = await new HybridStore(f.sb, f.core).searchChunks(args);
    expect(r.map((x) => x.id)).toEqual(["old"]);
    expect(f.calls.sb.at(-1)).toBeNull(); // the fallback asked for everything
  });
  it("entry titles come from Neon, with Supabase as the fallback", async () => {
    const ok = fakes({ core: [] });
    expect((await new HybridStore(ok.sb, ok.core).titleChunks(["davi"])).map((r) => r.id)).toEqual(["core-title"]);
    const bad = fakes({ core: new Error("down") });
    expect((await new HybridStore(bad.sb, bad.core).titleChunks(["davi"])).map((r) => r.id)).toEqual(["sb-title"]);
  });
  it("verses and lenses always come from Supabase", async () => {
    const f = fakes();
    const h = new HybridStore(f.sb, f.core);
    expect(await h.bibleVerses("v", [], [])).toEqual([]);
    expect(await h.lensWorks!(["pentecostal"])).toEqual(["own_notes_pentecostal"]);
  });
});
