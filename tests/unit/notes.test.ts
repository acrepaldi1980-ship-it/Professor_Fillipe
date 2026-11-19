import { describe, expect, it } from "vitest";
import { checkAndRewrite, containment, cosine, paragraphsOf, scoreParagraph, SIMILARITY_THRESHOLD, windows } from "../../lib/notes/originality";
import { canMove, nextMoves } from "../../lib/notes/status";
import { ACTS_PLAN } from "../../lib/notes/acts";
import { findReferences } from "../../lib/knowledge/refs-parser";

const SRC = "the day of pentecost was fully come they were all with one accord in one place and suddenly there came a sound from heaven as of a rushing mighty wind";
const embed = async (t: string[]) => t.map((x) => [x.includes("pentecost") ? 1 : 0, x.includes("rewritten") ? 1 : 0.1]);

describe("originality", () => {
  it("measures 5-gram containment", () => {
    expect(containment(SRC, SRC)).toBe(1);
    expect(containment("totally different words about another subject entirely here today", SRC)).toBe(0);
  });
  it("cosine and windows", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(windows("a b c").length).toBe(1);
    expect(windows(Array(300).fill("w").join(" ")).length).toBeGreaterThan(3);
  });
  it("splits paragraphs", () => {
    expect(paragraphsOf("a\n\n\nb\n\n c ")).toEqual(["a", "b", "c"]);
  });
  it("flags a copied paragraph and rewrites it until it passes", async () => {
    const deps = { sourcesFor: async () => [{ id: "w:1", text: SRC }], embed, rewrite: async () => "texto reescrito com outras palavras e outra estrutura de frases totalmente novas para este assunto bíblico rewritten" };
    const copied = `${SRC} and then some more words follow the first sentence of this paragraph`;
    const s = await scoreParagraph(copied, 0, deps);
    expect(s.flagged).toBe(true);
    const out = await checkAndRewrite(copied, deps);
    expect(out.report.rewrites).toBe(1);
    expect(out.report.maxSimilarity).toBeLessThan(SIMILARITY_THRESHOLD);
    expect(out.body).toContain("reescrito");
  });
  it("leaves an original paragraph alone", async () => {
    const deps = { sourcesFor: async () => [{ id: "w:1", text: SRC }], embed, rewrite: async () => "x" };
    const out = await checkAndRewrite("Este parágrafo explica com palavras próprias o contexto histórico da cidade de Jerusalém na época dos apóstolos e por que isso importa.", deps);
    expect(out.report.rewrites).toBe(0);
  });
});

describe("review workflow", () => {
  it("lets reviewers move notes but only admins publish", () => {
    expect(canMove("draft", "in_review", "reviewer")).toBe(true);
    expect(canMove("in_review", "approved", "reviewer")).toBe(true);
    expect(canMove("approved", "published", "reviewer")).toBe(false);
    expect(canMove("approved", "published", "admin")).toBe(true);
    expect(canMove("draft", "published", "admin")).toBe(false);
    expect(canMove("published", "draft", "reviewer")).toBe(false);
    expect(nextMoves("in_review", "reviewer")).toEqual(["approved", "draft"]);
  });
});

describe("Acts plan", () => {
  it("has an intro, pericopes and articles, and every passage parses", () => {
    expect(ACTS_PLAN.filter((n) => n.kind === "intro")).toHaveLength(1);
    expect(ACTS_PLAN.filter((n) => n.kind === "article").length).toBeGreaterThanOrEqual(8);
    expect(ACTS_PLAN.filter((n) => n.kind === "pericope").length).toBeGreaterThanOrEqual(50);
    for (const n of ACTS_PLAN) {
      const refs = findReferences(n.passage);
      expect(refs.length, n.passage).toBeGreaterThan(0);
      expect(refs.some((r) => r.invalid), n.passage).toBe(false);
    }
    expect(new Set(ACTS_PLAN.map((n) => n.title)).size).toBe(ACTS_PLAN.length);
  });
});
