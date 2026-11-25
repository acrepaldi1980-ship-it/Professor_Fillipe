import { describe, expect, it } from "vitest";
import { entityHints, findEntities, fuzzyName, subjectOf } from "@/lib/knowledge/entities";

const en = (q: string) => findEntities(q).map((m) => m.en);

describe("entity recognition (Portuguese names of Bible people and places)", () => {
  it("finds Zaqueu, whatever the sentence around it", () => {
    for (const q of ["Me fale tudo sobre Zaqueu", "quem foi zaqueu?", "ZAQUEU", "Conte a história de Zaqueu, o publicano"]) expect(en(q), q).toContain("Zacchaeus");
    expect(entityHints("Me fale tudo sobre Zaqueu").refs.some((r) => r.startsWith("LUK.19"))).toBe(true);
  });
  it("finds the usual names, with and without accents", () => {
    const cases: Record<string, string> = {
      "Quem foi Moisés?": "Moses", "quem foi moises": "Moses", "Fale sobre Abraão": "Abraham", "Quem foi Davi?": "David", "Salomão e sua sabedoria": "Solomon",
      "Quem foi Barnabé?": "Barnabas", "A vida de Estêvão": "Stephen", "Nicodemos": "Nicodemus", "Quem foi Lázaro": "Lazarus", "Jonas e o peixe": "Jonah",
      "Quem foi Noé?": "Noah", "Sansão": "Samson", "A história de Rute": "Ruth", "Ester": "Esther", "Quem foi Elias": "Elijah", "Eliseu": "Elisha",
      "Gideão": "Gideon", "Quem foi Pilatos": "Pontius Pilate", "Fale sobre Jerusalém": "Jerusalem", "Onde fica Belém?": "Bethlehem", "Sobre Nazaré": "Nazareth",
    };
    for (const [q, name] of Object.entries(cases)) expect(en(q).some((x) => x.startsWith(name)), `${q} -> ${en(q).join("|")}`).toBe(true);
  });
  it("finds places with two words", () => {
    expect(en("Me explique sobre o Monte Carmelo")).toContain("Mount Carmel");
    expect(en("O que aconteceu no Mar Vermelho")).toEqual(expect.arrayContaining([expect.stringMatching(/Red Sea/)]));
  });
  it("forgives a misspelling", () => {
    expect(fuzzyName("nicodemo")).toBe("nicodemos");
    expect(en("quem foi Zaquel")).toContain("Zacchaeus");
  });
  it("does not invent entities for ordinary questions", () => {
    expect(findEntities("Qual é a capital da França?")).toEqual([]);
    expect(findEntities("O que é a graça?")).toEqual([]);
  });
  it("reduces a question to its subject", () => {
    expect(subjectOf("Me fale tudo sobre Zaqueu")).toBe("Zaqueu");
    expect(subjectOf("Quem foi Barnabé?")).toBe("Barnabé");
    expect(subjectOf("Zaqueu")).toBe("");
  });
});
