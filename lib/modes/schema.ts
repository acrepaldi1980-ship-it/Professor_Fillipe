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
  return /\b(sim|pode|pode colocar|coloca|aprovado|aprovo|combinado|fechado|gostei|ok|perfeito|isso mesmo|concordo|vamos com essa|pode ser)\b/.test(t);
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
