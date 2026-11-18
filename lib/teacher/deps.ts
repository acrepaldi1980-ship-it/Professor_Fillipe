// Real dependencies for the teacher pipeline (server only).
import { getStore } from "../knowledge/db";
import { getVerses, searchChunks } from "../knowledge/search";
import { AnthropicTeacherLlm } from "./anthropic";
import { GroqTeacherLlm, rewriteQueryToEnglish } from "./groq";
import type { TurnDeps } from "./pipeline";

/** Provider: TEACHER_LLM_PROVIDER=anthropic|groq. Default: Anthropic when a key exists, otherwise Groq (free, prototype only). */
export function teacherProvider(): "anthropic" | "groq" {
  const forced = process.env.TEACHER_LLM_PROVIDER;
  if (forced === "anthropic" || forced === "groq") return forced;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq";
}

export function createTurnDeps(): TurnDeps {
  return {
    contextTokens: Number(process.env.TEACHER_CONTEXT_TOKENS) || (teacherProvider() === "groq" ? 1800 : 6000),
    historyMessages: teacherProvider() === "groq" ? 6 : 24,
    llm: teacherProvider() === "anthropic" ? new AnthropicTeacherLlm() : new GroqTeacherLlm(),
    search: (q, opts) => searchChunks(q, opts),
    rewriteQuery: process.env.GROQ_API_KEY || process.env.QUERY_REWRITE !== "off" ? rewriteQueryToEnglish : undefined,
    getVerses: (versionId, refs) => getVerses(versionId, refs),
    async existingVerses(versionId, refs) {
      if (!refs.length) return new Set<string>();
      const rows = await getStore().bibleVerses(versionId, refs, []);
      return new Set(rows.map((r) => r.ref));
    },
  };
}
