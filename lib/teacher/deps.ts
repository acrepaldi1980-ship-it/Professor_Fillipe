// Real dependencies for the teacher pipeline (server only).
import { getStore } from "../knowledge/db";
import { getVerses, searchChunks } from "../knowledge/search";
import { AnthropicTeacherLlm } from "./anthropic";
import { GroqTeacherLlm, rewriteQueryToEnglish } from "./groq";
import type { TurnDeps } from "./pipeline";
import { FallbackLlm } from "./fallback-llm";
import { loadActiveLayers } from "./prompt-store";

/** Provider: TEACHER_LLM_PROVIDER=anthropic|groq. Default: Anthropic when a key exists, otherwise Groq (free, prototype only). */
export function teacherProvider(): "anthropic" | "groq" {
  const forced = process.env.TEACHER_LLM_PROVIDER;
  if (forced === "anthropic" || forced === "groq") return forced;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq";
}

export function createTurnDeps(): TurnDeps {
  return {
    contextTokens: Number(process.env.TEACHER_CONTEXT_TOKENS) || (teacherProvider() === "groq" ? 1800 : 3200),
    historyMessages: teacherProvider() === "groq" ? 6 : 8,
    // Claude first; when it is unavailable (no credit, overload) the free Groq model answers instead of an error.
    llm: teacherProvider() === "anthropic" ? (process.env.GROQ_API_KEY ? new FallbackLlm(new AnthropicTeacherLlm(), new GroqTeacherLlm()) : new AnthropicTeacherLlm()) : new GroqTeacherLlm(),
    search: (q, opts) => searchChunks(q, opts),
    rewriteQuery: process.env.GROQ_API_KEY || process.env.QUERY_REWRITE !== "off" ? rewriteQueryToEnglish : undefined,
    getVerses: (versionId, refs) => getVerses(versionId, refs),
    loadLayers: loadActiveLayers,
    async existingVerses(versionId, refs) {
      if (!refs.length) return new Set<string>();
      const rows = await getStore().bibleVerses(versionId, refs, []);
      return new Set(rows.map((r) => r.ref));
    },
  };
}
