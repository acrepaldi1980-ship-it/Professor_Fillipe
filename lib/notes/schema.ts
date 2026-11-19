import { z } from "zod";

export const NoteKind = z.enum(["intro", "pericope", "article"]);
export const NoteStatusSchema = z.enum(["draft", "in_review", "approved", "published"]);

export const GenerateRequest = z.object({
  kind: NoteKind,
  book: z.string().regex(/^[A-Z0-9]{3}$/), // canonical book code, e.g. ACT
  title: z.string().min(3).max(160),
  /** Passage in Portuguese ("Atos 2:1-13"); for articles, the main passages. */
  passage: z.string().min(3).max(200),
  /** Optional theme hint for articles. */
  theme: z.string().max(300).optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

/** What the model must return. */
export const DraftOutput = z.object({
  title: z.string().min(3).max(160),
  body: z.string().min(200).max(6000),
  used_sources: z.array(z.string()).max(12).default([]),
});
export type DraftOutput = z.infer<typeof DraftOutput>;

export const SourceRef = z.object({
  type: z.enum(["bible", "work"]),
  id: z.string(),
  label: z.string(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const PatchRequest = z.object({
  status: NoteStatusSchema.optional(),
  body: z.string().min(50).max(6000).optional(),
  title: z.string().min(3).max(160).optional(),
});
export const CommentRequest = z.object({ body: z.string().min(1).max(4000) });
