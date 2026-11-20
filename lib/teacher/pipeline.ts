// One teacher turn (spec 8.5.1): crisis check → intent → references → retrieval → prompt → model → validation
// → citation verification → memory. Every dependency is injected so the pipeline is testable without network.
import type { BibleVerse, Retrieved, SearchOptions } from "../knowledge/search";
import { memory, type ChatMessage } from "./memory";
import { pastoralResponse } from "./pastoral";
import { classify, DEEP_INTENTS, extractRefs, moderate, resolveSearch, selectTier, wordLimit } from "./stages";
import { buildSystemParts, DEFAULT_BIBLE, PROMPT_DB_VERSION, DEFAULT_STUDENT, type BibleSettings, type StudentProfile } from "./prompts";
import { countWords, teacherResponseSchema, type Intent, type TeacherResponse } from "./schema";
import { repairWorkCitations, verifyCitations } from "./citations";
import { findUngroundedNames, groundingNotice } from "./grounding";
import { ensureClosingQuestion } from "./speech";
import { normalizeRaw } from "./normalize";

export interface TeacherLlm {
  /** Returns the raw `teacher_response` tool input (unvalidated). */
  /** Optional token use of this turn (Anthropic): calls, input, output, cache reads and writes. */
  stats?(): { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; blocks?: string };
  generate(args: { system: string; systemParts?: { stable: string; dynamic: string }; messages: ChatMessage[]; tier: "fast" | "deep" }): Promise<unknown>;
}

export interface TurnDeps {
  llm: TeacherLlm;
  search(query: string | string[], opts?: SearchOptions): Promise<{ chunks: Retrieved[]; refs: string[] }>;
  getVerses(versionId: string, refs: string[]): Promise<BibleVerse[]>;
  /** Context budget in tokens for retrieved chunks (spec: ~6000; smaller for free-tier prototype models). */
  contextTokens?: number;
  /** Keep only the last N messages of history (free-tier prototype). */
  historyMessages?: number;
  /** Optional: English keywords for the question, to reach English works from a Portuguese question. */
  rewriteQuery?(question: string): Promise<string | null>;
  existingVerses(versionId: string, refs: string[]): Promise<Set<string>>;
  /** Optional: active prompt layers from prompt_versions (falls back to the built-in version 1). */
  loadLayers?(): Promise<import("./prompt-store").PromptLayers | null>;
}

export interface TurnInput {
  sessionId: string;
  text: string;
  student?: StudentProfile;
  bible?: BibleSettings;
  intent?: Intent;
  /** Guided mode of the session and its setup (lesson, sermon, deep). */
  mode?: string;
  modeContext?: Record<string, unknown>;
  sermonTypeDefinition?: string;
  /** Extra source lines (e.g. original-language words in the deepen mode), placed with the retrieved chunks. */
  extraSources?: string;
  /** Recent conversation loaded from the database (survives serverless instances); falls back to the in-memory copy. */
  history?: ChatMessage[];
  /** Bible references of the previous answer, so "esse texto" can be resolved. */
  lastRefs?: string[];
}

export interface TurnResult {
  response: TeacherResponse;
  /** Retrieved sources of this turn (used by the evals; never sent to the client). */
  retrieved: { id: string; work_id: string; title_path: string | null; text: string }[];
  meta: {
    intent: Intent;
    tier: "fast" | "deep" | "none";
    pastoral: boolean;
    retrievedChunks: number;
    lensChunks?: number;
    /** Version of the prompt layers used (prompt_versions). */
    promptVersion?: number;
    removedCitations: number;
    schemaRetries: number;
    speechRewrites: number;
    words: number;
    overWordLimit: boolean;
    latencyMs: number;
    /** True when the model failed for good and a friendly fallback answer was returned instead. */
    degraded?: boolean;
    /** Short technical code of the failure (never user text). */
    degradedReason?: string;
    retrievalMs: number;
    llmMs: number;
    llm?: { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; blocks?: string };
  };
}

export { isFollowUp } from "./stages";

/** Builds a minimal valid response from whatever speech text the model produced (no citations: nothing unverified is claimed). */
export function salvageText(raw: unknown, name: string): TeacherResponse | null {
  const speech = raw && typeof raw === "object" && typeof (raw as { speech?: unknown }).speech === "string" ? (raw as { speech: string }).speech.trim() : "";
  if (speech.length < 20) return null;
  const base = fallbackResponse(name);
  return { ...base, speech, next_options: [{ label: "Continuar", intent: "next" }, { label: "Encerrar por agora", intent: "stop" }] };
}

function fallbackResponse(name: string): TeacherResponse {
  return {
    speech: `${name}, tive um problema para responder agora. Pode repetir a pergunta ou escrever de outro jeito?`,
    display_markdown: "",
    citations: [],
    visuals: [],
    next_options: [
      { label: "Tentar de novo", intent: "ask" },
      { label: "Encerrar por agora", intent: "stop" },
    ],
    lens_divergence: { present: false, summary: null },
    pastoral_flag: false,
    level_signal: "same",
    mode_payload: null,
  };
}

export async function runTurn(input: TurnInput, deps: TurnDeps): Promise<TurnResult> {
  const t0 = Date.now();
  const student = input.student ?? DEFAULT_STUDENT;
  const bible = input.bible ?? DEFAULT_BIBLE;
  const baseMeta = { retrievedChunks: 0, removedCitations: 0, schemaRetries: 0, speechRewrites: 0, retrievalMs: 0, llmMs: 0 };

  // 1) Crisis detection happens before any generation and the text is never stored (RA-17).
  if (moderate(input.text).crisis) {
    const response = pastoralResponse(student.preferred_name);
    return {
      response,
      retrieved: [],
      meta: { ...baseMeta, intent: "ask", tier: "none", pastoral: true, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0 },
    };
  }

  // 2) Intent and 3) references cited by the student.
  const intent = classify(input.text, input.intent);
  const mentioned = extractRefs(input.text);
  const priorHistory = input.history ?? memory.get(input.sessionId);
  // Follow-ups ("aprofunde esse texto", "e o irmão mais velho?") carry no subject of their own: borrow it from the conversation.
  const { searchText, carriedRefs } = resolveSearch({ text: input.text, intent, mentioned, history: priorHistory, lastRefs: input.lastRefs });

  // 4) Retrieval.
  const tSearch = Date.now();
  const rewritten = deps.rewriteQuery ? await deps.rewriteQuery(searchText) : null;
  const wantedVerses = [...mentioned, ...carriedRefs];
  // The search and the verse lookup do not depend on each other: run them together.
  const [{ chunks }, verses, layers] = await Promise.all([
    deps.search(rewritten ? [searchText, rewritten] : searchText, { extraRefs: carriedRefs, lenses: bible.lenses, maxTokens: deps.contextTokens, maxChunks: deps.contextTokens && deps.contextTokens < 4000 ? 8 : undefined }),
    wantedVerses.length ? deps.getVerses(bible.main_version_id, wantedVerses.slice(0, 20)) : Promise.resolve([]),
    deps.loadLayers ? deps.loadLayers().catch(() => null) : Promise.resolve(null),
  ]);

  const retrievalMs = Date.now() - tSearch;

  // 5) Prompt and 6) generation.
  const deepNote = DEEP_INTENTS.includes(intent)
    ? "MODO APROFUNDAR: o aluno quer a análise detalhada. Coloque o detalhamento em display_markdown (títulos curtos e listas, até 250 palavras por bloco, só com o que está nos trechos) e use speech para um resumo falado de até 250 palavras que convide a continuar. Se os trechos não cobrirem algum ponto, diga qual."
    : "";
  const baseNotice = groundingNotice(findUngroundedNames({ question: input.text, chunkTexts: [...chunks.map((c) => c.text), ...verses.map((v) => v.text)], rewritten }));
  const notice = [baseNotice, deepNote].filter(Boolean).join("\n\n") || undefined;
  const small = !!deps.contextTokens && deps.contextTokens < 4000;
  const maxChunkChars = small ? 1300 : undefined;
  let parts = buildSystemParts({ student, bible, chunks, verses, notice: [notice, input.extraSources].filter(Boolean).join("\n\n") || undefined, maxChunkChars, layers, mode: input.mode, modeContext: input.modeContext, sermonTypeDefinition: input.sermonTypeDefinition });
  const joined = () => `${parts.stable}\n\n---\n\n${parts.dynamic}`;
  // On "request too large" (free-tier token limits) retry once with half of the retrieved context.
  let lastRaw: unknown = null;
  const generate = async (msgs: ChatMessage[]) => {
    try {
      return (lastRaw = normalizeRaw(await deps.llm.generate({ system: joined(), systemParts: parts, messages: msgs, tier }), bible.main_version_id));
    } catch (e) {
      if (!/413/.test((e as Error).message)) throw e;
      parts = buildSystemParts({ student, bible, chunks: chunks.slice(0, Math.max(2, Math.ceil(chunks.length / 2))), verses: verses.slice(0, 10), notice, maxChunkChars, layers, mode: input.mode, modeContext: input.modeContext, sermonTypeDefinition: input.sermonTypeDefinition });
      return (lastRaw = normalizeRaw(await deps.llm.generate({ system: joined(), systemParts: parts, messages: msgs, tier }), bible.main_version_id));
    }
  };
  const history = priorHistory.slice(-(deps.historyMessages ?? 24));
  const messages: ChatMessage[] = [...history, { role: "user", content: input.text }];
  const tier = selectTier({ intent, mode: input.mode, lenses: bible.lenses });

  const tLlm = Date.now();
  // Optional extra passes (retry, shorter version, rewrite) must never break a turn that already has an answer.
  const tryGenerate = async (msgs: ChatMessage[]) => {
    try {
      return await generate(msgs);
    } catch {
      return null;
    }
  };
  let schemaRetries = 0;
  let parsed;
  try {
    parsed = teacherResponseSchema.safeParse(await generate(messages));
  } catch (e) {
    const response = fallbackResponse(student.preferred_name);
    return { response, retrieved: [], meta: { ...baseMeta, intent, tier, pastoral: false, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0, degraded: true, degradedReason: (e as Error).message.slice(0, 80), retrievalMs } };
  }
  if (!parsed.success) {
    schemaRetries = 1;
    const hint = `Sua resposta anterior não seguiu o contrato (${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}). Responda de novo chamando teacher_response corretamente.`;
    const retry = await tryGenerate([...messages, { role: "user", content: hint }]);
    if (retry) parsed = teacherResponseSchema.safeParse(retry);
  }
  // Still invalid: fall back to the plain text of the answer (spec 8.5.5) rather than failing the turn.
  let textFallback = false;
  if (!parsed.success) {
    const salvaged = salvageText(lastRaw, student.preferred_name);
    if (!salvaged) throw new Error("teacher_response_invalid");
    parsed = teacherResponseSchema.safeParse(salvaged);
    if (!parsed.success) throw new Error("teacher_response_invalid");
    textFallback = true;
  }

  // RA-06: spoken turns have a word limit; ask once for a shorter version (summary/deep intents have more room).
  const limit = wordLimit(intent, input.mode);
  let lengthRewrites = 0;
  if (countWords(parsed.data.speech) > Math.round(limit * 1.1)) {
    lengthRewrites = 1;
    const hint = `Sua fala tem ${countWords(parsed.data.speech)} palavras. Reduza a "speech" para no máximo ${limit} palavras, sem resumo nem desafio, e termine com uma pergunta ou escolha. O texto longo pode ir em display_markdown.`;
    const shorterRaw = await tryGenerate([...messages, { role: "user", content: hint }]);
    const shorter = shorterRaw ? teacherResponseSchema.safeParse(shorterRaw) : null;
    if (shorter?.success && countWords(shorter.data.speech) <= countWords(parsed.data.speech)) parsed = shorter;
  }
  const llmMs = Date.now() - tLlm;

  // 7) Citation verification (8.5.6).
  const retrievedChunkIds = new Set(chunks.map((c) => c.id));
  let ver = await verifyCitations(repairWorkCitations(parsed.data, chunks), { existingVerses: deps.existingVerses, retrievedChunkIds }, bible.main_version_id);
  let speechRewrites = 0;
  if (ver.invalidSpeechRefs.length) {
    speechRewrites = 1;
    const hint = `Atenção: você citou referências que não existem ou não estão nas fontes (${ver.invalidSpeechRefs.join(", ")}). Reformule sem elas e diga que não encontrou isso nas fontes, se for o caso.`;
    const againRaw = await tryGenerate([...messages, { role: "user", content: hint }]);
    const again = againRaw ? teacherResponseSchema.safeParse(againRaw) : null;
    if (again?.success) ver = await verifyCitations(repairWorkCitations(again.data, chunks), { existingVerses: deps.existingVerses, retrievedChunkIds }, bible.main_version_id);
    if (ver.invalidSpeechRefs.length) {
      // Last resort: do not speak an unverified reference.
      ver = { ...ver, response: { ...ver.response, speech: "Não encontrei essa passagem nas minhas fontes. Quer me dizer o livro e o capítulo de novo, ou prefere que eu sugira um texto parecido?" } };
    }
  }

  // 8) Memory (only what was said, never crisis text).
  const response = { ...ver.response, speech: ensureClosingQuestion(ver.response.speech) };
  memory.append(input.sessionId, { role: "user", content: input.text }, { role: "assistant", content: response.speech });

  const words = countWords(response.speech);
  return {
    response,
    retrieved: chunks.map((c) => ({ id: c.id, work_id: c.work_id, title_path: c.title_path, text: c.text })),
    meta: {
      intent,
      tier,
      pastoral: response.pastoral_flag,
      retrievedChunks: chunks.length,
      promptVersion: layers?.version ?? PROMPT_DB_VERSION,
      lensChunks: chunks.filter((c) => c.signals?.includes("lens")).length,
      removedCitations: ver.removed.length,
      schemaRetries,
      speechRewrites: speechRewrites + lengthRewrites,
      words,
      overWordLimit: words > limit,
      latencyMs: Date.now() - t0,
      retrievalMs,
      llmMs,
      llm: deps.llm.stats?.(),
      ...(textFallback ? { textFallback: true } : {}),
    },
  };
}
