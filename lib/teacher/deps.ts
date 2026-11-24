// Real dependencies for the teacher pipeline (server only).
import { webSearchDetailed, webSearchEnabled } from "../websearch";
import { getStore } from "../knowledge/db";
import { getVerses, searchChunks } from "../knowledge/search";
import { AnthropicTeacherLlm } from "./anthropic";
import { RouterTeacherLlm } from "../llm/teacher";
import { buildEndpoints } from "../llm/registry";
import { rewriteQueryToEnglish } from "./groq";
import type { TurnDeps } from "./pipeline";
import { FallbackLlm, primaryIsDown } from "./fallback-llm";
import { loadActiveLayers } from "./prompt-store";

/** Provider: TEACHER_LLM_PROVIDER=anthropic|groq. Default: Anthropic when a key exists, otherwise Groq (free, prototype only). */
export function teacherProvider(): "anthropic" | "groq" {
  const forced = process.env.TEACHER_LLM_PROVIDER;
  if (forced === "anthropic" || forced === "groq") return forced;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq";
}

export function createTurnDeps(): TurnDeps {
  // free models take smaller requests (a big prompt is refused with 413 and every refusal costs a round trip): size it for them while the main model is down
  const small = teacherProvider() === "groq" || primaryIsDown();
  return {
    contextTokens: Number(process.env.TEACHER_CONTEXT_TOKENS) || (small ? 1800 : 3200),
    historyMessages: small ? 6 : 8,
    // Claude first; when it is unavailable (no credit, overload) the free Groq model answers instead of an error.
    // Claude first when there is a key; otherwise (or when Claude is unavailable) the pool of free endpoints, with automatic failover between them.
    llm: teacherProvider() === "anthropic" ? (buildEndpoints().length ? new FallbackLlm(new AnthropicTeacherLlm(), new RouterTeacherLlm()) : new AnthropicTeacherLlm()) : new RouterTeacherLlm(),
    search: (q, opts) => searchChunks(q, opts),
    // research outside the app (spec 8.23): Wikipedia, and a general search when TAVILY_API_KEY is set; off with WEB_SEARCH=off
    webSearch: webSearchEnabled() ? (req) => webSearchDetailed(req) : undefined,
    rewriteQuery: buildEndpoints().length && process.env.QUERY_REWRITE !== "off" ? rewriteQueryToEnglish : undefined,
    getVerses: (versionId, refs) => getVerses(versionId, refs),
    loadLayers: loadActiveLayers,
    async existingVerses(versionId, refs) {
      if (!refs.length) return new Set<string>();
      const rows = await getStore().bibleVerses(versionId, refs, []);
      return new Set(rows.map((r) => r.ref));
    },
  };
}
