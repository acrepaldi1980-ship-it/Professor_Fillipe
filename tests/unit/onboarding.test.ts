import { describe, expect, it } from "vitest";
import { computeLevel, levelFromScore, suggestLevelChange, vocabularyScore } from "../../lib/onboarding/level";
import { reaction, STEPS, TOTAL_STEPS, visibleSteps } from "../../lib/onboarding/script";

describe("level estimate (RF-M03-02)", () => {
  it("combines experience, role and vocabulary", () => {
    expect(computeLevel({ experience: "starting", role: "none", openAnswers: ["quero entender a Bíblia"] })).toMatchObject({ score: 0, level: "iniciante" });
    expect(computeLevel({ experience: "2_10y", role: "ebd_teacher", openAnswers: ["alianca"] })).toMatchObject({ score: 51, level: "intermediário" });
    expect(computeLevel({ experience: "gt_10y", role: "pastor", openAnswers: ["exegese do grego koine e a escatologia", "hermenêutica"] }).level).toBe("avançado");
  });
  it("caps at 100 and uses the documented thresholds", () => {
    expect(computeLevel({ experience: "gt_10y", role: "student_theology", openAnswers: ["exegese hermenêutica escatologia perícope soteriologia cristologia"] }).score).toBe(100);
    expect([34, 35, 69, 70].map(levelFromScore)).toEqual(["iniciante", "intermediário", "intermediário", "avançado"]);
  });
  it("is deterministic: the same answers always give the same level", () => {
    const i = { experience: "lt_2y" as const, role: "leader" as const, openAnswers: ["aliança e escatologia"] };
    expect(computeLevel(i)).toEqual(computeLevel({ ...i }));
  });
  it("counts each technical term once, ignoring accents", () => {
    expect(vocabularyScore("Exegese, exegese, EXEGESE")).toBe(6);
    expect(vocabularyScore("aliança escatologia perícope")).toBe(18);
    expect(vocabularyScore("quero conhecer Jesus")).toBe(0);
  });
});

describe("continuous adjustment (RF-M03-05)", () => {
  it("offers a change only every 5 sessions and with 3 of 5 signals", () => {
    const up = ["higher", "higher", "same", "higher", "same"] as const;
    expect(suggestLevelChange([...up], 5, "iniciante")).toBe("intermediário");
    expect(suggestLevelChange([...up], 6, "iniciante")).toBeNull();
    expect(suggestLevelChange(["higher", "higher", "same", "same", "same"], 5, "iniciante")).toBeNull();
    expect(suggestLevelChange(["lower", "lower", "lower", "same", "same"], 10, "avançado")).toBe("intermediário");
    expect(suggestLevelChange(["higher", "higher", "higher", "same", "same"], 5, "avançado")).toBeNull();
    expect(suggestLevelChange(["lower", "lower", "lower", "same", "same"], 5, "iniciante")).toBeNull();
  });
});

describe("interview script (RF-M03-01)", () => {
  it("has 7 numbered steps and question 4 only with consent", () => {
    expect(TOTAL_STEPS).toBe(7);
    expect(Math.max(...STEPS.map((s) => s.n))).toBe(7);
    expect(visibleSteps({ religiousConsent: false }).map((s) => s.id)).toEqual(["name", "experience", "goals", "minutes", "formats", "topic"]);
    expect(visibleSteps({ religiousConsent: true, ministry: "pastor" }).map((s) => s.id)).not.toContain("age_group");
    expect(visibleSteps({ religiousConsent: true, ministry: "ebd_teacher" }).map((s) => s.id)).toContain("age_group");
  });
  it("reacts in one short, varied sentence", () => {
    const seen = new Set(["Ana", "Joel", "Marcos", "Lucas"].map((n) => reaction("name", n)));
    expect(seen.size).toBe(4);
    for (const s of STEPS) {
      const r = reaction(s.id, s.options?.[0]?.value ?? "tema", "Ana");
      expect(r.split(/\s+/).length).toBeLessThanOrEqual(20);
      expect(r).toBe(reaction(s.id, s.options?.[0]?.value ?? "tema", "Ana"));
    }
  });
});
