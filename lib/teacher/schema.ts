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
  z.object({ kind: z.literal("illustration"), prompt: z.string(), style: z.string().default("app_default"), alt: z.string().optional() }),
  z.object({ kind: z.literal("model3d"), model_id: z.string() }),
]);

/** A page read OUTSIDE the app that the answer relies on (set by the server from the pages it really read, never by the model). */
export const externalSource = z.object({ title: z.string(), url: z.string(), site: z.string(), lang: z.string(), license: z.string(), retrieved_at: z.string() });
export type ExternalSource = z.infer<typeof externalSource>;

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
  /** The model's own judgement: the passages it was given answer the question (false makes the server research outside the app, when allowed). */
  sources_sufficient: z.boolean().optional(),
  external_sources: z.array(externalSource).max(4).optional(),
});

export type TeacherResponse = z.infer<typeof teacherResponseSchema>;
export type Citation = TeacherResponse["citations"][number];

/** Compact JSON schema for the forced `teacher_response` tool (spec 11.6). Hand-written and flat to save tokens on free-tier
 *  models (the generated schema cost ~700 tokens per turn); the Zod schema above remains the source of truth for validation. */
export function teacherToolJsonSchema() {
  const s = { type: "string" };
  return {
    type: "object",
    properties: {
      speech: s,
      display_markdown: s,
      citations: {
        type: "array",
        items: { type: "object", properties: { type: { enum: ["bible", "work"] }, ref: s, version_id: s, work_id: s, chunk_id: s, label: s }, required: ["type"] },
      },
      visuals: {
        type: "array",
        maxItems: 2,
        items: { type: "object", properties: { kind: { enum: ["map", "timeline", "illustration", "model3d"] }, map_id: s, timeline_id: s, prompt: s, model_id: s }, required: ["kind"] },
      },
      next_options: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "object", properties: { label: s, intent: { enum: [...INTENTS] } }, required: ["label", "intent"] },
      },
      lens_divergence: { type: "object", properties: { present: { type: "boolean" }, summary: { type: ["string", "null"] } } },
      pastoral_flag: { type: "boolean" },
      level_signal: { enum: ["lower", "same", "higher"] },
      avatar_cue: { enum: [...AVATAR_CUES] },
      sources_sufficient: { type: "boolean" },
    },
    required: ["speech", "next_options"],
  };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** RA-06: spoken turns are at most 120 words (summary 300, deep blocks 250). */
export const WORD_LIMITS = { normal: 120, summary: 300, deep: 250 } as const;
