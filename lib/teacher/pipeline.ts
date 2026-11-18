// One teacher turn (spec 8.5.1): crisis check → intent → references → retrieval → prompt → model → validation
// → citation verification → memory. Every dependency is injected so the pipeline is testable without network.
import { findReferences } from "../knowledge/refs-parser";
import type { BibleVerse, Retrieved, SearchOptions } from "../knowledge/search";
import { classifyIntent } from "./intents";
import { memory, type ChatMessage } from "./memory";
import { detectPastoralCrisis, pastoralResponse } from "./pastoral";
import { buildSystemPrompt, DEFAULT_BIBLE, DEFAULT_STUDENT, type BibleSettings, type StudentProfile } from "./prompts";
import { countWords, teacherResponseSchema, WORD_LIMITS, type Intent, type TeacherResponse } from "./schema";
import { repairWorkCitations, verifyCitations } from "./citations";
import { findUngroundedNames, groundingNotice } from "./grounding";
import { ensureClosingQuestion } from "./speech";

export interface TeacherLlm {
  /** Returns the raw `teacher_response` tool input (unvalidated). */
  generate(args: { system: string; messages: ChatMessage[]; tier: "fast" | "deep" }): Promise<unknown>;
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
}

export interface TurnInput {
  sessionId: string;
  text: string;
  student?: StudentProfile;
  bible?: BibleSettings;
  intent?: Intent;
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
    removedCitations: number;
    schemaRetries: number;
    speechRewrites: number;
    words: number;
    overWordLimit: boolean;
    latencyMs: number;
    /** True when the model failed for good and a friendly fallback answer was returned instead. */
    degraded?: boolean;
    retrievalMs: number;
    llmMs: number;
  };
}

const DEEP_INTENTS: Intent[] = ["deepen", "other_traditions", "compare_versions"];

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
  if (detectPastoralCrisis(input.text)) {
    const response = pastoralResponse(student.preferred_name);
    return {
      response,
      retrieved: [],
      meta: { ...baseMeta, intent: "ask", tier: "none", pastoral: true, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0 },
    };
  }

  // 2) Intent and 3) references cited by the student.
  const intent = input.intent ?? classifyIntent(input.text);
  const mentioned = findReferences(input.text).flatMap((r) => r.refs);

  // 4) Retrieval.
  const tSearch = Date.now();
  const rewritten = deps.rewriteQuery ? await deps.rewriteQuery(input.text) : null;
  const { chunks } = await deps.search(rewritten ? [input.text, rewritten] : input.text, { lenses: bible.lenses, maxTokens: deps.contextTokens, maxChunks: deps.contextTokens && deps.contextTokens < 4000 ? 8 : undefined });
  const verses = mentioned.length ? await deps.getVerses(bible.main_version_id, mentioned.slice(0, 20)) : [];

  const retrievalMs = Date.now() - tSearch;

  // 5) Prompt and 6) generation.
  const notice = groundingNotice(findUngroundedNames({ question: input.text, chunkTexts: [...chunks.map((c) => c.text), ...verses.map((v) => v.text)], rewritten }));
  const small = !!deps.contextTokens && deps.contextTokens < 4000;
  const maxChunkChars = small ? 1300 : undefined;
  let system = buildSystemPrompt({ student, bible, chunks, verses, notice, maxChunkChars });
  // On "request too large" (free-tier token limits) retry once with half of the retrieved context.
  const generate = async (msgs: ChatMessage[]) => {
    try {
      return await deps.llm.generate({ system, messages: msgs, tier });
    } catch (e) {
      if (!/413/.test((e as Error).message)) throw e;
      system = buildSystemPrompt({ student, bible, chunks: chunks.slice(0, Math.max(2, Math.ceil(chunks.length / 2))), verses: verses.slice(0, 10), notice, maxChunkChars });
      return deps.llm.generate({ system, messages: msgs, tier });
    }
  };
  const history = memory.get(input.sessionId).slice(-(deps.historyMessages ?? 24));
  const messages: ChatMessage[] = [...history, { role: "user", content: input.text }];
  const tier = DEEP_INTENTS.includes(intent) ? "deep" : "fast";

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
  } catch {
    const response = fallbackResponse(student.preferred_name);
    return { response, retrieved: [], meta: { ...baseMeta, intent, tier, pastoral: false, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0, degraded: true, retrievalMs } };
  }
  if (!parsed.success) {
    schemaRetries = 1;
    const hint = `Sua resposta anterior não seguiu o contrato (${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}). Responda de novo chamando teacher_response corretamente.`;
    const retry = await tryGenerate([...messages, { role: "user", content: hint }]);
    if (retry) parsed = teacherResponseSchema.safeParse(retry);
  }
  if (!parsed.success) throw new Error("teacher_response_invalid");

  // RA-06: spoken turns have a word limit; ask once for a shorter version (summary/deep intents have more room).
  const limit = DEEP_INTENTS.includes(intent) ? WORD_LIMITS.deep : WORD_LIMITS.normal;
  let lengthRewrites = 0;
  if (countWords(parsed.data.speech) > limit) {
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
      removedCitations: ver.removed.length,
      schemaRetries,
      speechRewrites: speechRewrites + lengthRewrites,
      words,
      overWordLimit: words > limit,
      latencyMs: Date.now() - t0,
      retrievalMs,
      llmMs,
    },
  };
}
