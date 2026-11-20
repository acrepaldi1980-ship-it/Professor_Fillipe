import { describe, expect, it } from "vitest";
import { applyLessonPayload, applySermonPayload, isApproval, lessonGaps, LessonContext, sermonGaps } from "../../lib/modes/schema";

describe("lesson plan payloads", () => {
  it("fills one section at a time", () => {
    let plan = applyLessonPayload({}, { section: "objective", content: ["Explicar quem foi Filipe", "Identificar o eunuco"] });
    expect(plan?.objective).toHaveLength(2);
    plan = applyLessonPayload(plan!, { section: "icebreaker", content: "Pergunte: quem já explicou a Bíblia a alguém?" });
    expect(plan?.icebreaker).toContain("Pergunte");
    expect(plan?.objective).toHaveLength(2);
  });
  it("rejects content that does not fit the section", () => {
    expect(applyLessonPayload({}, { section: "objective", content: "texto em vez de lista" })).toBeNull();
    expect(applyLessonPayload({}, { section: "nope", content: "x" })).toBeNull();
    expect(applyLessonPayload({}, { section: "objective", content: ["a", "b", "c", "d"] })).toBeNull();
  });
  it("lists the gaps of an incomplete plan", () => {
    expect(lessonGaps({})).toContain("Falta o objetivo.");
    expect(lessonGaps({ objective: ["x"], icebreaker: "x", context: "x", dynamic: "x", application: "x", memory_verse: "x", points: [{ title: "a", verses: [], explanation: "" }, { title: "b", verses: [], explanation: "" }, { title: "c", verses: [], explanation: "" }], questions: ["1", "2", "3", "4"] })).toEqual([]);
  });
  it("validates the setup (duration and age group)", () => {
    expect(LessonContext.safeParse({ topic: "Filipe", age_group: "adults", minutes: 45 }).success).toBe(true);
    expect(LessonContext.safeParse({ topic: "Filipe", age_group: "adults", minutes: 50 }).success).toBe(false);
  });
});

describe("RA-10: a sermon part enters the outline only with the preacher's approval", () => {
  it("recognises approvals and refusals", () => {
    for (const ok of ["Sim, pode colocar", "ok", "Combinado!", "pode ser", "Gostei, aprovado"]) expect(isApproval(ok), ok).toBe(true);
    for (const no of ["não, prefiro outra", "ainda não", "espera, quero mudar", "Qual a diferença entre agape e phileo?"]) expect(isApproval(no), no).toBe(false);
  });
  it("ignores the model's payload when the student did not approve", () => {
    const payload = { part: "central_idea", content: "Deus alcança quem busca" };
    expect(applySermonPayload({}, payload, "Me explica o contexto")).toBeNull();
    expect(applySermonPayload({}, payload, "Sim, pode colocar")?.central_idea).toBe("Deus alcança quem busca");
  });
  it("adds divisions in order and keeps the rest", () => {
    let o = applySermonPayload({}, { part: "division", content: { title: "O chamado", texts: ["ACT.8.26"], explanation: "x" } }, "pode colocar")!;
    o = applySermonPayload(o, { part: "division", content: { title: "O encontro", texts: ["ACT.8.30"], explanation: "y", application: "z" } }, "ok")!;
    expect(o.divisions?.map((d) => d.title)).toEqual(["O chamado", "O encontro"]);
  });
  it("finds gaps in the final review", () => {
    const gaps = sermonGaps({ central_idea: "x", divisions: [{ title: "a", texts: [], explanation: "" }] });
    expect(gaps).toContain("A divisão 1 ainda não tem aplicação.");
    expect(gaps).toContain("O apelo ainda não está no esboço.");
  });
});
