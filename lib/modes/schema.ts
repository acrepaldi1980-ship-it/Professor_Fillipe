// Mode documents (spec 8.7): the lesson plan and the sermon outline that fill in beside the conversation through `mode_payload`.
import { z } from "zod";

export const AGE_GROUPS = ["kids", "teens", "youth", "adults", "mixed"] as const;
export const DURATIONS = [30, 45, 60, 90] as const;

// ---- Lesson plan (8.7.2) ----
export const LESSON_SECTIONS = ["title", "objective", "icebreaker", "context", "points", "dynamic", "questions", "application", "memory_verse", "visuals", "sources", "timing"] as const;
export type LessonSection = (typeof LESSON_SECTIONS)[number];

const str = z.string().max(2000);
export const LessonPlan = z.object({
  title: str.optional(),
  base_text: str.optional(),
  objective: z.array(str).max(3).optional(),
  icebreaker: str.optional(),
  context: str.optional(),
  points: z.array(z.object({ title: str, verses: z.array(z.string().max(40)).max(8).default([]), explanation: str.default(""), illustration: str.optional() })).max(5).optional(),
  dynamic: str.optional(),
  questions: z.array(str).max(8).optional(),
  application: str.optional(),
  memory_verse: str.optional(),
  visuals: z.array(str).max(6).optional(),
  sources: z.array(str).max(30).optional(),
  timing: z.array(z.object({ section: str, minutes: z.number().int().min(0).max(120) })).max(12).optional(),
});
export type LessonPlan = z.infer<typeof LessonPlan>;

export const LessonContext = z.object({
  topic: z.string().trim().min(2).max(200),
  ref: z.string().trim().max(120).optional(),
  age_group: z.enum(AGE_GROUPS),
  minutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  magazine: z.string().trim().max(120).optional(),
});
export type LessonContext = z.infer<typeof LessonContext>;

// ---- Sermon outline (8.7.3) ----
export const SermonOutline = z.object({
  title: str.optional(),
  type: z.string().max(40).optional(),
  base_text: str.optional(),
  central_idea: str.optional(),
  introduction: str.optional(),
  divisions: z.array(z.object({ title: str, texts: z.array(z.string().max(40)).max(8).default([]), explanation: str.default(""), illustration: str.optional(), application: str.optional() })).max(6).optional(),
  conclusion: str.optional(),
  appeal: str.optional(),
  sources: z.array(str).max(30).optional(),
  estimated_minutes: z.number().int().min(1).max(120).optional(),
});
export type SermonOutline = z.infer<typeof SermonOutline>;

export const SermonContext = z.object({
  sermon_type: z.string().trim().min(2).max(40),
  ref_or_theme: z.string().trim().min(2).max(200),
});
export type SermonContext = z.infer<typeof SermonContext>;

export const DeepContext = z.object({ ref: z.string().trim().min(2).max(120) });

export const MODES = ["free", "lesson", "sermon", "deep"] as const;
export type Mode = (typeof MODES)[number];

// ---- mode_payload (spec 8.5.5): only the part updated in this turn ----
export const LessonPayload = z.object({ section: z.enum(LESSON_SECTIONS), content: z.unknown() });
export const SermonPayload = z.object({ part: z.enum(["title", "central_idea", "introduction", "division", "conclusion", "appeal", "sources", "estimated_minutes"]), content: z.unknown(), index: z.number().int().min(0).max(5).optional() });

/** Applies one section of a lesson payload to the plan; returns the new plan or null when the content does not fit the section. */
export function applyLessonPayload(plan: LessonPlan, raw: unknown): LessonPlan | null {
  const p = LessonPayload.safeParse(raw);
  if (!p.success) return null;
  const key = p.data.section === "title" ? "title" : p.data.section;
  const candidate = { ...plan, [key]: p.data.content };
  const ok = LessonPlan.safeParse(candidate);
  return ok.success ? ok.data : null;
}

/** RA-10: a sermon part enters the outline only when the preacher approved it in this turn. */
export function isApproval(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (/\b(nao|negativo|ainda nao|espera|melhor nao|prefiro outra|outra opcao)\b/.test(t)) return false;
  // an explicit request to write it into the document is an approval too ("coloque no esboço", "preencha", "escreva a introdução")
  return /\b(sim|pode|pode colocar|coloca|coloque|colocar no|preencha|preencher|escreva|escrever|adicione|inclua|ponha|aprovado|aprovo|combinado|fechado|gostei|ok|perfeito|isso mesmo|concordo|vamos com essa|pode ser)\b/.test(t);
}

export function applySermonPayload(outline: SermonOutline, raw: unknown, userText: string): SermonOutline | null {
  if (!isApproval(userText)) return null;
  const p = SermonPayload.safeParse(raw);
  if (!p.success) return null;
  let candidate: Record<string, unknown>;
  if (p.data.part === "division") {
    const list = [...(outline.divisions ?? [])];
    const i = p.data.index ?? list.length;
    list[i] = p.data.content as never;
    candidate = { ...outline, divisions: list };
  } else {
    candidate = { ...outline, [p.data.part]: p.data.content };
  }
  const ok = SermonOutline.safeParse(candidate);
  return ok.success ? ok.data : null;
}

/** Gaps the final review points out (8.7.3 step 6). */
export function sermonGaps(o: SermonOutline): string[] {
  const gaps: string[] = [];
  if (!o.central_idea) gaps.push("A ideia central ainda não foi definida.");
  if (!o.introduction) gaps.push("A introdução (com gancho) ainda não está no esboço.");
  (o.divisions ?? []).forEach((d, i) => {
    if (!d.application) gaps.push(`A divisão ${i + 1} ainda não tem aplicação.`);
    if (!d.texts?.length) gaps.push(`A divisão ${i + 1} ainda não tem textos bíblicos.`);
  });
  if (!(o.divisions ?? []).length) gaps.push("Ainda não há divisões.");
  if (!o.conclusion) gaps.push("A conclusão ainda não está no esboço.");
  if (!o.appeal) gaps.push("O apelo ainda não está no esboço.");
  return gaps;
}

export function lessonGaps(p: LessonPlan): string[] {
  const gaps: string[] = [];
  if (!p.objective?.length) gaps.push("Falta o objetivo.");
  if (!p.icebreaker) gaps.push("Falta o quebra-gelo.");
  if (!p.context) gaps.push("Falta o contexto.");
  if ((p.points?.length ?? 0) < 3) gaps.push("Faltam pontos principais (de 3 a 5).");
  if (!p.dynamic) gaps.push("Falta a dinâmica.");
  if ((p.questions?.length ?? 0) < 4) gaps.push("Faltam perguntas de discussão (de 4 a 8).");
  if (!p.application) gaps.push("Falta a aplicação.");
  if (!p.memory_verse) gaps.push("Falta o versículo para memorizar.");
  return gaps;
}

/** The section each gap refers to, in the same order as `lessonGaps` / `sermonGaps`, so the screen can ask for a suggestion for that gap. */
export function lessonGapKeys(p: LessonPlan): string[] {
  const k: string[] = [];
  if (!p.objective?.length) k.push("objective");
  if (!p.icebreaker) k.push("icebreaker");
  if (!p.context) k.push("context");
  if ((p.points?.length ?? 0) < 3) k.push("points");
  if (!p.dynamic) k.push("dynamic");
  if ((p.questions?.length ?? 0) < 4) k.push("questions");
  if (!p.application) k.push("application");
  if (!p.memory_verse) k.push("memory_verse");
  return k;
}

export function sermonGapKeys(o: SermonOutline): string[] {
  const k: string[] = [];
  if (!o.central_idea) k.push("central_idea");
  if (!o.introduction) k.push("introduction");
  (o.divisions ?? []).forEach((d, i) => {
    if (!d.application) k.push(`division_application:${i}`);
    if (!d.texts?.length) k.push(`division_texts:${i}`);
  });
  if (!(o.divisions ?? []).length) k.push("division");
  if (!o.conclusion) k.push("conclusion");
  if (!o.appeal) k.push("appeal");
  return k;
}

// ---- Deep study (Aprofundar): researched from the Bible text, the original words and the library ----
export const DeepStudy = z.object({
  title: str.optional(),
  passage: str.optional(),
  overview: str.optional(),
  context: str.optional(),
  structure: z.array(z.object({ title: str, refs: z.array(z.string().max(40)).max(8).default([]), summary: str.default("") })).max(8).optional(),
  keywords: z.array(z.object({ surface: z.string().max(60), translit: z.string().max(60).nullish(), lemma: z.string().max(60).nullish(), strong: z.string().max(12).nullish(), gloss: z.string().max(120).nullish(), note: z.string().max(600).default("") })).max(10).optional(),
  traditions: z.array(z.object({ tradition: z.string().max(60), reading: z.string().max(1200), work: z.string().max(200).optional() })).max(6).optional(),
  /** History of interpretation by era (church fathers, reformers, later traditions), each from a work of the library. */
  history: z.array(z.object({ era: z.string().max(60), summary: z.string().max(1400), work: z.string().max(240).optional() })).max(6).optional(),
  crossrefs: z.array(z.string().max(40)).max(20).optional(),
  application: str.optional(),
  bibliography: z.array(z.object({ work: z.string().max(600), tradition: z.string().max(60).optional() })).max(16).optional(),
});
export type DeepStudy = z.infer<typeof DeepStudy>;

export function deepGaps(d: DeepStudy): { key: string; text: string }[] {
  const g: { key: string; text: string }[] = [];
  if (!d.overview) g.push({ key: "overview", text: "Falta o resumo do texto." });
  if (!d.context) g.push({ key: "context", text: "Falta o contexto histórico e literário." });
  if (!d.structure?.length) g.push({ key: "structure", text: "Falta a estrutura do texto." });
  if (!d.keywords?.length) g.push({ key: "keywords", text: "Faltam as palavras-chave no original." });
  if (!d.traditions?.length) g.push({ key: "traditions", text: "Faltam as visões das tradições." });
  if (!d.history?.length) g.push({ key: "history", text: "Falta a história da interpretação." });
  if (!d.application) g.push({ key: "application", text: "Falta a aplicação." });
  if (!d.crossrefs?.length) g.push({ key: "crossrefs", text: "Faltam as referências cruzadas." });
  if (!d.bibliography?.length) g.push({ key: "bibliography", text: "Falta a bibliografia." });
  return g;
}
