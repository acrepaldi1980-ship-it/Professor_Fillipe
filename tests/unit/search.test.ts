import { describe, expect, it } from "vitest";
import { authorityLayer, rerankAndSelect } from "@/lib/knowledge/search";

const row = (id: string, kind: string, rrf: number, tokens = 300, tradition = "general") => ({
  id, work_id: "w", text: id, title_path: null, refs: [], tradition, kind, language: "en", tokens, rrf, signals: ["semantic"],
});

describe("authority layers", () => {
  it("follows the weights of spec 8.10.6", () => {
    expect(authorityLayer("bible_text", "general").weight).toBe(1);
    expect(authorityLayer("lexicon", "general").weight).toBe(0.95);
    expect(authorityLayer("own_notes", "pentecostal", ["pentecostal"]).weight).toBe(0.9);
    expect(authorityLayer("own_notes", "pentecostal", []).weight).toBe(0.7);
    expect(authorityLayer("history", "general").weight).toBe(0.8);
    expect(authorityLayer("encyclopedia", "general").weight).toBe(0.6);
  });
});

describe("rerankAndSelect", () => {
  it("lets a Bible chunk outrank a slightly better-fused encyclopedia chunk", () => {
    const out = rerankAndSelect([row("enc", "encyclopedia", 0.03), row("bib", "bible_text", 0.02)]);
    expect(out[0].id).toBe("bib");
  });

  it("guarantees one Bible chunk even when it ranks low", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`d${i}`, "dictionary", 0.05 - i * 0.001, 450));
    rows.push(row("bib", "bible_text", 0.001));
    const out = rerankAndSelect(rows, { maxChunks: 12, maxTokens: 3000 });
    expect(out.some((r) => r.id === "bib")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(12);
    expect(out.reduce((s, r) => s + (r.tokens ?? 0), 0)).toBeLessThanOrEqual(3000 + 450);
  });
});
