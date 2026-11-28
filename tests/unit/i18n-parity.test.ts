import { describe, expect, it } from "vitest";
import ptBR from "@/lib/i18n/pt-BR.json";
import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";
import it_ from "@/lib/i18n/it.json";
import { LANGS } from "@/lib/i18n/languages";

const dicts: Record<string, Record<string, string>> = {
  "pt-BR": ptBR,
  en,
  es,
  it: it_,
};
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();

describe("i18n parity (D-29: four languages)", () => {
  it("has a dictionary for every supported language", () => {
    for (const l of LANGS) expect(dicts[l], l).toBeTruthy();
  });

  for (const lang of ["en", "es", "it"]) {
    it(`${lang} has exactly the keys of pt-BR`, () => {
      const base = Object.keys(ptBR).sort();
      expect(Object.keys(dicts[lang]).sort()).toEqual(base);
    });

    it(`${lang} keeps the same placeholders as pt-BR`, () => {
      const bad = Object.keys(ptBR).filter(
        (k) =>
          JSON.stringify(placeholders((ptBR as Record<string, string>)[k])) !==
          JSON.stringify(placeholders(dicts[lang][k] ?? "")),
      );
      expect(bad).toEqual([]);
    });

    it(`${lang} has no empty strings`, () => {
      expect(Object.entries(dicts[lang]).filter(([, v]) => !v.trim())).toEqual([]);
    });
  }
});
