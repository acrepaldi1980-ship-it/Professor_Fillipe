// Structured output contract of the teacher (spec 8.5.5). The UI only consumes this object.
import { z } from "zod";

export const INTENTS = [
  "ask", "deepen", "simplify", "example", "show_map", "show_timeline",
  "compare_versions", "other_traditions", "next", "stop", "off_topic",
] as const;
export type Intent = (typeof INTENTS)[number];

export const AVATAR_CUES = ["neutral", "happy", "surprised", "thoughtful", "empathetic", "pointing"] as const;

const citation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bible"), ref: z.string(), version_id: z.string() }),
  z.object({ type: z.literal("work"), work_id: z.string(), chunk_id: z.string(), label: z.string() }),
]);

const visual = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("map"), map_id: z.string(), highlight_place_ids: z.array(z.string()).default([]) }),
  z.object({ kind: z.literal("timeline"), timeline_id: z.string(), focus_event_id: z.string().optional() }),
  z.object({ kind: z.literal("illustration"), prompt: z.string(), style: z.string().default("app_default") }),
  z.object({ kind: z.literal("model3d"), model_id: z.string() }),
]);

export const teacherResponseSchema = z.object({
  speech: z.string().min(1),
  display_markdown: z.string().default(""),
  citations: z.array(citation).default([]),
  visuals: z.array(visual).max(2).default([]),
  next_options: z.array(z.object({ label: z.string(), intent: z.enum(INTENTS) })).min(2).max(4),
  lens_divergence: z.object({ present: z.boolean(), summary: z.string().nullable() }).default({ present: false, summary: null }),
  pastoral_flag: z.boolean().default(false),
  level_signal: z.enum(["lower", "same", "higher"]).default("same"),
  avatar_cue: z.enum(AVATAR_CUES).optional(),
  mode_payload: z.record(z.string(), z.unknown()).nullable().default(null),
});

export type TeacherResponse = z.infer<typeof teacherResponseSchema>;
export type Citation = TeacherResponse["citations"][number];

/** JSON schema for the forced `teacher_response` tool (spec 11.6). */
export function teacherToolJsonSchema() {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(teacherResponseSchema, { io: "input" }) as Record<string, unknown>;
  void _ignored;
  return schema;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** RA-06: spoken turns are at most 120 words (summary 300, deep blocks 250). */
export const WORD_LIMITS = { normal: 120, summary: 300, deep: 250 } as const;
