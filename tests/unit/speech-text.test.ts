import { describe, expect, it } from "vitest";
import { applyLexicon, expandReferencesForSpeech, prepareForSpeech, splitSentences } from "@/lib/voice/speech-text";

describe("speech text", () => {
  it("reads Bible references the way a person would", () => {
    expect(expandReferencesForSpeech("Veja João 3:16 hoje.")).toBe("Veja João, capítulo 3, versículo 16 hoje.");
    expect(expandReferencesForSpeech("Leia 1 Coríntios 13:4-7.")).toBe("Leia Primeiro Coríntios, capítulo 13, versículos 4 a 7.");
    expect(expandReferencesForSpeech("Salmo 23")).toBe("Salmos, capítulo 23");
    expect(expandReferencesForSpeech("Gênesis 1-3")).toContain("capítulos 1 a 3");
  });

  it("does not touch ordinary prose", () => {
    expect(expandReferencesForSpeech("eram os 3 homens no caminho")).toBe("eram os 3 homens no caminho");
  });

  it("applies the pronunciation lexicon without touching substrings", () => {
    expect(applyLexicon("Nabucodonosor reinou.")).toContain("Nabucodonózor");
    expect(applyLexicon("Elias")).toBe("Elias");
  });

  it("strips markdown and collapses spaces", () => {
    expect(prepareForSpeech("**Atenção:**   texto")).toBe("Atenção: texto");
  });

  it("splits sentences and keeps short ones attached", () => {
    expect(splitSentences("Oi! Eu sou o Professor Filipe. Entendes o que lês?", 10)).toEqual(["Oi! Eu sou o Professor Filipe.", "Entendes o que lês?"]);
    expect(splitSentences("Oi! Eu sou o Professor Filipe. Entendes o que lês?")).toHaveLength(1);
    expect(splitSentences("Sem pontuação final")).toEqual(["Sem pontuação final"]);
  });
});
