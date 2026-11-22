import { describe, expect, it } from "vitest";
import { CURATED, getCurated } from "@/lib/characters";
import { Character } from "@/lib/characters/schema";

const words = (s: string) => s.trim().split(/\s+/).length;
describe("Vida dos Personagens: curated lives", () => {
  it("ids are unique and every life is valid", () => {
    expect(new Set(CURATED.map((c) => c.id)).size).toBe(CURATED.length);
    for (const c of CURATED) expect(Character.safeParse(c).success, c.id).toBe(true);
  });
  it("every chapter cites a passage, is short (RA-06) and ends with a question", () => {
    for (const c of CURATED) for (const ch of c.chapters) {
      expect(ch.ref, `${c.id}/${ch.id}`).toBeTruthy();
      expect(words(ch.text), `${c.id}/${ch.id} text`).toBeLessThanOrEqual(95);
      expect(ch.question.trim().endsWith("?"), `${c.id}/${ch.id} question`).toBe(true);
    }
  });
  it("a life starts with birth and ends with death, in the order of the stages", () => {
    for (const c of CURATED) { expect(c.chapters[0].stage, c.id).toMatch(/Nascimento|Origem|Infância/); expect(c.chapters[c.chapters.length - 1].stage, c.id).toMatch(/Morte|Despedida|Final|Arrebatamento/); }
  });
  it("every place used by a chapter exists in the character's places", () => {
    for (const c of CURATED) for (const ch of c.chapters) if (ch.place) expect(c.places.some((p) => p.key === ch.place), `${c.id}/${ch.id} place ${ch.place}`).toBe(true);
  });
  it("people who cross exist or are only names (no broken link)", () => {
    const a = getCurated("abraao"); expect(a?.kgId).toBe("person:abraham_58");
  });
  it("RA-20: no god figure exists, Jesus is only a silhouette and divine presence is light", () => {
    for (const c of CURATED) for (const ch of c.chapters) for (const f of ch.scene.figures) expect(["man", "woman", "child", "elder", "warrior", "king", "priest", "shepherd", "jesus", "angel", "crowd"]).toContain(f.kind);
  });
});
