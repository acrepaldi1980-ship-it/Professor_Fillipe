import { afterEach, describe, expect, it } from "vitest";
import es from "@/lib/i18n/es.json";
import ptBR from "@/lib/i18n/pt-BR.json";
import { defaultBibleVersion, getLanguage, isLang, setLanguage, t } from "@/lib/i18n";
import { SPANISH_DOC } from "@/lib/modes/build";
import { buildSystemParts, DEFAULT_STUDENT, LAYER_IDENTITY, layerLanguage } from "@/lib/teacher/prompts";

afterEach(() => setLanguage("pt-BR"));
const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("es.json (RNF-10: Spanish prepared)", () => {
  const keys = Object.keys(ptBR) as (keyof typeof ptBR)[];
  it("has exactly the keys of pt-BR", () => {
    expect(Object.keys(es).sort()).toEqual([...keys].sort());
  });
  it("has no empty value", () => {
    for (const k of keys) expect((es as Record<string, string>)[k].trim().length, k).toBeGreaterThan(0);
  });
  it("keeps every placeholder of the Portuguese text", () => {
    for (const k of keys) expect(ph((es as Record<string, string>)[k]), k).toBe(ph(ptBR[k]));
  });
  it("is really translated: no Portuguese-only words left", () => {
    const pt = /\b(você|não|também|então|seu|sua|obrigado|conta)\b/i;
    for (const k of keys) {
      const v = (es as Record<string, string>)[k];
      if (k === "church.create.cnpj") continue;
      expect(pt.test(v) && !/cuenta/i.test(v), `${k}: ${v}`).toBe(false);
    }
  });
  it("keeps the product name and the slogan in the owner's form", () => {
    expect(es["app.name"]).toBe("Profesor Filipe");
    expect(es["app.tagline"]).toContain("Entiendes");
  });
  it("keeps the rule that the teacher is an AI and the sources are credited", () => {
    expect(es["landing.ia"]).toMatch(/inteligencia artificial/);
    expect(es["share.card.credit"]).toMatch(/Reina-Valera 1909/);
  });
});

describe("language switch", () => {
  it("t() reads the current language and falls back to Portuguese", () => {
    expect(t("home.hello")).toBe("Olá");
    setLanguage("es");
    expect(getLanguage()).toBe("es");
    expect(t("home.hello")).toBe("Hola");
    expect(defaultBibleVersion()).toBe("spa_rv_1909");
    setLanguage("pt-BR");
    expect(defaultBibleVersion()).toBe("por_blivre_2018");
  });
  it("validates a language code", () => {
    expect(isLang("es")).toBe(true); expect(isLang("pt-BR")).toBe(true); expect(isLang("fr")).toBe(false); expect(isLang(null)).toBe(false);
  });
});

describe("teacher in Spanish", () => {
  const bible = { lenses: [], main_version_id: "spa_rv_1909", main_version_name: "Reina-Valera 1909", compare_versions: [] };
  it("adds the Spanish layer only for a Spanish-speaking student", () => {
    expect(layerLanguage(DEFAULT_STUDENT)).toBe("");
    expect(layerLanguage({ ...DEFAULT_STUDENT, locale: "pt-BR" })).toBe("");
    const l = layerLanguage({ ...DEFAULT_STUDENT, locale: "es" });
    expect(l).toContain("ESPANHOL"); expect(l).toContain("Profesor Filipe"); expect(l).toContain("Nunca traduza um versículo");
  });
  it("puts the layer and the Spanish Bible version in the stable part of the prompt", () => {
    const es_ = buildSystemParts({ student: { ...DEFAULT_STUDENT, locale: "es" }, bible, chunks: [], verses: [] }).stable;
    expect(es_).toContain("IDIOMA: este aluno estuda em ESPANHOL");
    expect(es_).toContain("Reina-Valera 1909");
    const pt_ = buildSystemParts({ student: DEFAULT_STUDENT, chunks: [], verses: [] }).stable;
    expect(pt_).not.toContain("ESPANHOL");
  });
  it("keeps every rule of the teacher in Spanish mode (the layer adds, never replaces)", () => {
    const stable = buildSystemParts({ student: { ...DEFAULT_STUDENT, locale: "es" }, bible, chunks: [], verses: [] }).stable;
    expect(stable).toContain(LAYER_IDENTITY);
  });
  it("documents (lesson, sermon, study) are asked in Spanish too", () => {
    expect(SPANISH_DOC).toContain("espanhol"); expect(SPANISH_DOC).toContain("ACT.8.30");
  });
});
