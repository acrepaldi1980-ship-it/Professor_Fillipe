import { describe, expect, it } from "vitest";
import { searchChunks } from "../../lib/knowledge/search";

const row = (id: string, tradition: string) => ({ id, work_id: id.split(":")[0], text: "texto sobre o dom de línguas", title_path: id, refs: [] as string[], tradition, kind: "theology", language: "pt", tokens: 100, rrf: 0.02, signals: ["semantic"] });

describe("lens search", () => {
  it("adds a search restricted to the works of the student's lens", async () => {
    const calls: (string[] | null | undefined)[] = [];
    const store = {
      async searchChunks(a: { workIds?: string[] | null }) {
        calls.push(a.workIds);
        return a.workIds ? [row("spurgeon:1", "baptist")] : [row("easton:1", "general")];
      },
      async bibleVerses() { return []; },
      async lensWorks(t: string[]) { return t.includes("baptist") ? ["spurgeon", "gill"] : []; },
    };
    const emb = { name: "t", dimensions: 2, async embedQuery() { return [0.1, 0.2]; }, async embedPassages(t: string[]) { return t.map(() => [0.1, 0.2]); } };
    const { chunks } = await searchChunks("Os dons ainda existem?", { lenses: ["baptist"] }, { store, embeddings: emb, library: null });
    expect(calls).toContainEqual(["spurgeon", "gill"]);
    expect(chunks.map((c) => c.id)).toEqual(expect.arrayContaining(["spurgeon:1", "easton:1"]));
    expect(chunks.find((c) => c.id === "spurgeon:1")?.signals).toContain("lens");
  });
  it("does nothing extra without a lens", async () => {
    const calls: unknown[] = [];
    const store = { async searchChunks(a: { workIds?: string[] | null }) { calls.push(a.workIds); return [row("easton:1", "general")]; }, async bibleVerses() { return []; }, async lensWorks() { return ["x"]; } };
    const emb = { name: "t", dimensions: 1, async embedQuery() { return [0.1]; }, async embedPassages(t: string[]) { return t.map(() => [0.1]); } };
    await searchChunks("pergunta qualquer", {}, { store, embeddings: emb, library: null });
    expect(calls).toHaveLength(1);
  });
});
