// Real dependencies for the teacher pipeline (server only).
import { getDb, lit, litArray } from "../knowledge/db";
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
    contextTokens: Number(process.env.TEACHER_CONTEXT_TOKENS) || (teacherProvider() === "groq" ? 2500 : 6000),
    llm: teacherProvider() === "anthropic" ? new AnthropicTeacherLlm() : new GroqTeacherLlm(),
    search: (q, opts) => searchChunks(q, opts),
    rewriteQuery: process.env.GROQ_API_KEY || process.env.QUERY_REWRITE !== "off" ? rewriteQueryToEnglish : undefined,
    getVerses: (versionId, refs) => getVerses(versionId, refs),
    async existingVerses(versionId, refs) {
      if (!refs.length) return new Set<string>();
      const rows = await getDb().query<{ ref: string }>(
        `select ref from bible_verses where version_id = ${lit(versionId)} and ref = any (${litArray(refs)})`,
      );
      return new Set(rows.map((r) => r.ref));
    },
  };
}
