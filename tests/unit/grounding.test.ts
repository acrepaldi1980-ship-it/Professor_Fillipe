import { describe, expect, it } from "vitest";
import { findUngroundedNames, groundingNotice } from "@/lib/teacher/grounding";

const find = (question: string, chunkTexts: string[] = [], rewritten?: string) => findUngroundedNames({ question, chunkTexts, rewritten });

describe("name grounding", () => {
  it("flags a book that does not exist", () => {
    expect(find("Quem foi o profeta Zebedias, autor do livro de Zebedias?", ["Zebadias A Levite."])).toContain("Zebedias");
  });
  it("flags a letter that does not exist", () => {
    expect(find("O que Paulo escreve na Terceira Carta aos Coríntios?")).toContain("Terceira Carta aos Coríntios");
  });
  it("flags a name with an ordinal suffix", () => {
    expect(find("Quem foi o apóstolo Tadeu Segundo e o que ele escreveu?", ["Thaddaeus apostle"])).toContain("Tadeu Segundo");
  });
  it("accepts real books and names that exist in the sources (pt/en spelling differences)", () => {
    expect(find("Explique o livro de Romanos")).toEqual([]);
    expect(find("Quem foi o profeta Elias?", ["Elijah the Tishbite"], "Elijah, prophet")).toEqual([]);
    expect(find("Quem foi o apóstolo Tadeu?", ["Thaddaeus apostle"])).toEqual([]);
    expect(find("Quem foi o rei Davi?", ["David king of Israel"])).toEqual([]);
    expect(find("Quem foi Barnabé?", ["Barnabas a Levite"])).toEqual([]);
    expect(find("Me mostra João 3:17 a 3:40")).toEqual([]);
  });
  it("flags a role-introduced name that is nowhere in the sources", () => {
    expect(find("Quem foi o profeta Xilofão?", ["Barnabas a Levite"])).toContain("Xilofão");
  });
  it("builds a notice only when something is ungrounded", () => {
    expect(groundingNotice([])).toBeUndefined();
    expect(groundingNotice(["Zebedias"])).toContain("AVISO DE FONTE");
  });
});
