import { describe, expect, it } from "vitest";
import { isApproval, lessonGapKeys, lessonGaps, LessonPlan, sermonGapKeys, sermonGaps, SermonOutline } from "@/lib/modes/schema";
import { buildPrompt, isValidSection, suggestSection } from "@/lib/modes/suggest";

const knows = (ok: string[]) => async (v: string) => ok.includes(v);

describe("gap keys follow the gaps", () => {
  it("lesson: one key per gap, in order", () => {
    const p = LessonPlan.parse({ title: "x", objective: ["a"], context: "c" });
    expect(lessonGapKeys(p)).toEqual(["icebreaker", "points", "dynamic", "questions", "application", "memory_verse"]);
    expect(lessonGapKeys(p).length).toBe(lessonGaps(p).length);
  });
  it("sermon: keys match the gaps, with the division index", () => {
    const o = SermonOutline.parse({ central_idea: "x", introduction: "y", divisions: [{ title: "d", texts: [], explanation: "" }], conclusion: "z", appeal: "a" });
    expect(sermonGapKeys(o)).toEqual(["division_application:0", "division_texts:0"]);
    expect(sermonGapKeys(o).length).toBe(sermonGaps(o).length);
    expect(sermonGapKeys(SermonOutline.parse({}))).toEqual(["central_idea", "introduction", "division", "conclusion", "appeal"]);
  });
});

describe("approval by explicit request", () => {
  for (const t of ["Coloque no esboço", "pode escrever a introdução", "Preencha esta parte", "Sugira e coloque no documento"]) it(`approves: ${t}`, () => expect(isApproval(t)).toBe(true));
  it("a refusal is not an approval", () => expect(isApproval("não coloque ainda")).toBe(false));
});

describe("suggestSection", () => {
  it("valid sections only", () => {
    expect(isValidSection("lesson", "objective")).toBe(true);
    expect(isValidSection("lesson", "central_idea")).toBe(false);
    expect(isValidSection("sermon", "division_texts:1")).toBe(true);
    expect(isValidSection("sermon", "nope")).toBe(false);
  });
  it("writes a string section into the lesson", async () => {
    const r = await suggestSection({ mode: "lesson", context: { topic: "Filipe" }, doc: {}, section: "icebreaker" }, async () => ({ content: "Quem já explicou algo difícil a alguém?" }), knows([]));
    expect((r?.doc as { icebreaker?: string }).icebreaker).toMatch(/explicou/);
  });
  it("drops invented Bible references and keeps real ones", async () => {
    const r = await suggestSection({ mode: "lesson", context: { topic: "Filipe" }, doc: {}, section: "points" }, async () => ({ content: [{ title: "Obediência", verses: ["ACT.8.26", "ACT.99.1", "Atos 8:30"], explanation: "..." }] }), knows(["ACT.8.26", "ACT.8.30"]));
    const pts = (r?.doc as { points: { verses: string[] }[] }).points;
    expect(pts[0].verses).toEqual(["ACT.8.26", "ACT.8.30"]);
  });
  it("a memory verse that does not exist is refused", async () => {
    const r = await suggestSection({ mode: "lesson", context: {}, doc: {}, section: "memory_verse" }, async () => ({ content: "FAK.1.1" }), knows([]));
    expect(r).toBeNull();
  });
  it("adds the next sermon division and keeps the others", async () => {
    const doc = { divisions: [{ title: "Um", texts: ["ACT.8.26"], explanation: "x" }] };
    const r = await suggestSection({ mode: "sermon", context: { sermon_type: "Expositivo" }, doc, section: "division" }, async () => ({ content: { title: "Dois", texts: ["ACT.8.30"], explanation: "y", application: "z" } }), knows(["ACT.8.30"]));
    const d = (r?.doc as { divisions: { title: string }[] }).divisions;
    expect(d.map((x) => x.title)).toEqual(["Um", "Dois"]);
  });
  it("an unusable answer returns null", async () => {
    expect(await suggestSection({ mode: "lesson", context: {}, doc: {}, section: "objective" }, async () => ({ nothing: true }), knows([]))).toBeNull();
    expect(await suggestSection({ mode: "lesson", context: {}, doc: {}, section: "objective" }, async () => ({ content: "texto onde se esperava lista" }), knows([]))).toBeNull();
  });
  it("the prompt has the rules against invention and the setup", () => {
    const p = buildPrompt({ mode: "sermon", context: { sermon_type: "Expositivo", ref_or_theme: "Atos 8:26-40" }, doc: {}, section: "central_idea", sermonTypeDefinition: "Explica o texto versículo a versículo" });
    expect(p.system).toMatch(/NÃO invente/);
    expect(p.user).toMatch(/Atos 8:26-40/);
  });
});

import { humanizeRefs } from "@/lib/modes/suggest";
describe("humanizeRefs", () => {
  it("turns canonical codes into Portuguese and drops invented ones", () => {
    expect(humanizeRefs("Veja ACT.8.26-ACT.8.40 e também (ACT.8.30).")).toMatch(/Atos 8:26-40.*\(Atos 8:30\)/);
    expect(humanizeRefs("O eunuco (AT.8.26-AT.8.40) leu Isaías.")).toBe("O eunuco leu Isaías.");
    expect(humanizeRefs("Sem referência nenhuma.")).toBe("Sem referência nenhuma.");
  });
});
