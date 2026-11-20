// The stages of a teacher turn (spec 8.5.1) as small pure functions, so each one is tested on its own.
// runTurn in pipeline.ts only wires them together with the I/O (search, model, verification).
import { findReferences } from "../knowledge/refs-parser";
import { classifyIntent } from "./intents";
import { detectPastoralCrisis } from "./pastoral";
import { WORD_LIMITS, type Intent } from "./schema";
import type { ChatMessage } from "./memory";

/** 1) Moderation and pastoral-crisis detection: runs before any generation (RA-17). */
export function moderate(text: string): { crisis: boolean } {
  return { crisis: detectPastoralCrisis(text) };
}

/** 2) Intent: the one sent by the interface (buttons) wins over the voice-command classifier. */
export function classify(text: string, forced?: Intent): Intent {
  return forced ?? classifyIntent(text);
}

/** 3) Bible references the student cited (canonical refs). */
export function extractRefs(text: string): string[] {
  return findReferences(text).flatMap((r) => r.refs);
}

export const DEEP_INTENTS: Intent[] = ["deepen", "other_traditions", "compare_versions"];

const ANAPHORA = /\b(desse|dessa|disso|nesse|nessa|nisso|esse texto|essa passagem|essa parabola|esse trecho|sobre ele|sobre ela|dele|dela|continue|continua|aprofund|detalh|mais sobre|e o |e a |e os |e as |por que ele|por que ela)\b/i;

/** A question with no subject of its own that leans on the previous turn. */
export function isFollowUp(text: string, hasOwnRefs: boolean, intent: Intent): boolean {
  if (hasOwnRefs) return false;
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return ANAPHORA.test(t) || DEEP_INTENTS.includes(intent) || t.split(/\s+/).length < 8;
}

/** 4) What to search for: a follow-up borrows the subject and the references of the previous exchange. */
export function resolveSearch(a: { text: string; intent: Intent; mentioned: string[]; history: ChatMessage[]; lastRefs?: string[] }): { searchText: string; carriedRefs: string[]; followUp: boolean } {
  const followUp = isFollowUp(a.text, a.mentioned.length > 0, a.intent);
  const lastUser = [...a.history].reverse().find((m) => m.role === "user")?.content ?? "";
  return { followUp, searchText: followUp && lastUser ? `${lastUser} ${a.text}` : a.text, carriedRefs: followUp ? (a.lastRefs ?? []) : [] };
}

/** 6) Model tier (8.5.3): deep for Aprofundar-like intents, deepening modes, materials and 3+ traditions. */
export function selectTier(a: { intent: Intent; mode?: string; lenses?: string[] }): "fast" | "deep" {
  if (DEEP_INTENTS.includes(a.intent)) return "deep";
  if (a.mode && ["deep", "lesson", "sermon"].includes(a.mode)) return "deep";
  if ((a.lenses?.length ?? 0) >= 3) return "deep";
  return "fast";
}

/** Word limit of the spoken part (RA-06): deep turns have more room. */
export function wordLimit(intent: Intent, mode?: string): number {
  return DEEP_INTENTS.includes(intent) || mode === "deep" ? WORD_LIMITS.deep : WORD_LIMITS.normal;
}

/** Model of the short tasks (moderation, intent): TEACHER_MODEL_CLASSIFIER, a small fast model by default. */
export function classifierModel(): string {
  return process.env.TEACHER_MODEL_CLASSIFIER ?? "claude-haiku-5-5";
}
