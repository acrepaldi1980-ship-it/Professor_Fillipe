// Shapes of the reader API (spec 8.24), validated at the border with Zod.
import { z } from "zod";
import { LANGS, type Lang } from "../i18n/languages";

export const verseRef = z.string().regex(/^[0-9A-Z]{3}\.\d+\.\d+$/);
export const chapterRef = z.string().regex(/^[0-9A-Z]{3}\.\d+$/);
const versionId = z.string().regex(/^[a-z0-9_]{2,60}$/i);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const StateInput = z.object({
  version_id: versionId.optional(),
  compare_version_id: versionId.nullable().optional(),
  last_ref: z.string().regex(/^[0-9A-Z]{3}\.\d+(\.\d+)?$/).optional(),
  font_scale: z.number().min(0.8).max(2).optional(),
});

export const ReadsInput = z.object({ refs: z.array(verseRef).max(400).optional(), chapters: z.array(chapterRef).max(40).optional() }).refine((v) => (v.refs?.length ?? 0) + (v.chapters?.length ?? 0) > 0);

export const PlanCreate = z.object({
  key: z.string().max(40),
  start_date: day,
  name: z.string().min(1).max(120).optional(),
  custom: z.object({ from: z.string().length(3), to: z.string().length(3), days: z.number().int().min(1).max(1200) }).optional(),
});
export const PlanPatch = z.object({ id: z.string().uuid(), day: z.number().int().min(1).max(1200).optional(), done: z.boolean().optional(), paused: z.boolean().optional(), today: day.optional() });

export const COLORS = ["yellow", "green", "blue", "pink", "orange"] as const;
export const NoteInput = z.object({
  version_id: versionId,
  ref_start: verseRef,
  ref_end: verseRef.optional(),
  text: z.string().trim().min(1).max(4000),
  context: z.string().trim().max(40).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  color: z.enum(COLORS).nullable().optional(),
});
export const NotePatch = NoteInput.partial().extend({ id: z.string().uuid() });

export const ExplainInput = z.object({ version_id: versionId, ref_start: verseRef, ref_end: verseRef.optional(), locale: z.enum(LANGS as [Lang, ...Lang[]]).default("pt-BR"), refresh: z.boolean().optional() });

/** Verse references from `a` to `b` in the same chapter (a to b inclusive); across chapters, only the two ends are used (a short selection is the normal case). */
export function rangeRefs(a: string, b?: string, cap = 40): string[] {
  if (!b || b === a) return [a];
  const [bk, ch, v1] = a.split("."); const [bk2, ch2, v2] = b.split(".");
  if (bk !== bk2 || ch !== ch2) return [a, b];
  const from = Math.min(Number(v1), Number(v2)), to = Math.max(Number(v1), Number(v2));
  return Array.from({ length: Math.min(to - from + 1, cap) }, (_, i) => `${bk}.${ch}.${from + i}`);
}
