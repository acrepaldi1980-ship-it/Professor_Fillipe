import { describe, expect, it } from "vitest";
import { abntAuthors, abntBibliography, abntReference } from "@/lib/knowledge/abnt";
import { decodeMorph, langOfStrong } from "@/lib/knowledge/morphology";

describe("Greek morphology (Robinson codes)", () => {
  it("noun, article and verb of John 1:1", () => {
    expect(decodeMorph("N-DSF", "grc")?.text).toBe("substantivo, dativo, singular, feminino");
    expect(decodeMorph("T-NSM", "grc")?.text).toBe("artigo, nominativo, singular, masculino");
    expect(decodeMorph("V-IAI-3S", "grc")?.text).toBe("verbo, imperfeito, ativa, indicativo, 3ª pessoa, singular");
    expect(decodeMorph("PREP", "grc")?.text).toBe("preposição");
  });
  it("participle and second aorist", () => {
    expect(decodeMorph("V-PAP-NSM", "grc")?.text).toBe("verbo, presente, ativa, particípio, nominativo, singular, masculino");
    expect(decodeMorph("V-2AAI-3S", "grc")?.text).toContain("aoristo (2ª forma)");
  });
  it("unknown codes are returned, never thrown", () => {
    expect(decodeMorph("ZZZ-9", "grc")?.text).toBeTruthy();
    expect(decodeMorph(null, "grc")).toBeNull();
  });
});

describe("Hebrew morphology (TAHOT codes)", () => {
  it("verb of Genesis 1:1: qal perfect 3rd masculine singular", () => {
    expect(decodeMorph("HVqp3ms", "heb")?.text).toBe("verbo, qal, perfeito, 3ª pessoa, masculino, singular");
  });
  it("prefixes are decoded one by one", () => {
    expect(decodeMorph("HR/Ncfsa", "heb")?.text).toBe("preposição + substantivo, comum, feminino, singular, absoluto");
    expect(decodeMorph("HTd/Ncmpa", "heb")?.text).toContain("artigo definido + substantivo");
    expect(decodeMorph("HTo", "heb")?.text).toBe("marca de objeto direto");
  });
  it("the language comes from the Strong number", () => {
    expect(langOfStrong("H7225G")).toBe("heb");
    expect(langOfStrong("G3056")).toBe("grc");
  });
});

describe("ABNT references", () => {
  const w = { title: "Expositions of Holy Scripture: St. Matthew Chaps. IX to XXVIII", authors: ["Maclaren, Alexander"], pub_year: 1910, source_url: "https://www.gutenberg.org/ebooks/7351" };
  it("authors in capitals, surname first", () => {
    expect(abntAuthors(["Maclaren, Alexander"])).toBe("MACLAREN, Alexander");
    expect(abntAuthors(["Alexander Maclaren"])).toBe("MACLAREN, Alexander");
    expect(abntAuthors(["A, a", "B, b", "C, c", "D, d"])).toBe("A, a et al.");
  });
  it("a full reference with place/publisher marks, year and online access", () => {
    const r = abntReference(w, new Date(2026, 10, 21));
    expect(r).toBe("MACLAREN, Alexander. Expositions of Holy Scripture: St. Matthew Chaps. IX to XXVIII. [S.l.]: [s.n.], 1910. Disponível em: https://www.gutenberg.org/ebooks/7351. Acesso em: 21 nov. 2026.");
  });
  it("no author: the entry starts with the first word of the title in capitals; no year: [s.d.]", () => {
    expect(abntReference({ title: "Easton's Bible Dictionary" }, new Date(2026, 0, 5))).toBe("EASTON'S Bible Dictionary. [S.l.]: [s.n.], [s.d.].");
  });
  it("the list is alphabetical", () => {
    const l = abntBibliography([{ title: "B", authors: ["Zeta, Z"] }, { title: "A", authors: ["Alfa, A"] }]);
    expect(l[0].startsWith("ALFA")).toBe(true);
  });
});

import { diffWords, difference } from "@/lib/knowledge/diff";
describe("diffWords", () => {
  it("marks only the words that differ", () => {
    const segs = diffWords("No princípio era o Verbo", "No princípio existia a Palavra");
    expect(segs.map((s) => `${s.changed ? "*" : ""}${s.text}`)).toEqual(["No princípio", "*existia a Palavra"]);
  });
  it("ignores case, accents and punctuation", () => {
    expect(diffWords("Deus é amor.", "deus e AMOR").every((s) => !s.changed)).toBe(true);
    expect(difference("a b c d", "a b c d")).toBe(0);
    expect(difference("a b c d", "x y z w")).toBe(1);
  });
});

import { speakable } from "@/components/modes/DeepTools";
describe("speakable", () => {
  it("normalizes transliteration for the voice", () => {
    expect(speakable("archē")).toBe("arche");
    expect(speakable("be./re.Shit")).toBe("be re Shit");
    expect(speakable("ba.Ra'")).toBe("ba Ra");
    expect(speakable(null)).toBe("");
  });
});
