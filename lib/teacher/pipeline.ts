// One teacher turn (spec 8.5.1): crisis check → intent → references → retrieval → prompt → model → validation
// → citation verification → memory. Every dependency is injected so the pipeline is testable without network.
import type { BibleVerse, Retrieved, SearchOptions } from "../knowledge/search";
import { formatRefPt } from "../knowledge/refs-parser";
import { memory, type ChatMessage } from "./memory";
import { pastoralResponse } from "./pastoral";
import { classify, DEEP_INTENTS, extractRefs, moderate, resolveSearch, selectTier, wordLimit } from "./stages";
import { buildSystemParts, DEFAULT_BIBLE, PROMPT_DB_VERSION, DEFAULT_STUDENT, type BibleSettings, type StudentProfile } from "./prompts";
import { countWords, teacherResponseSchema, type Intent, type TeacherResponse } from "./schema";
import { sanitizeVisuals } from "../visuals/catalog";
import { repairWorkCitations, verifyCitations } from "./citations";
import { findUngroundedNames, groundingNotice } from "./grounding";
import { ensureClosingQuestion } from "./speech";
import { normalizeRaw } from "./normalize";
import { injectionResponse, leaksPrompt, screenInput } from "../security/injection";
import type { WebRequest, WebSource } from "../websearch/types";
import type { WebResult } from "../websearch";
import { assessCoverage, externalPrompt, looksUnanswered, outsideLabel, toResponseSources, UNSURE_NOTICE, ungroundedNumbers, usesOutside } from "./external";
import { offTopicResponse, topicGate, type TopicVerdict } from "./topic";

export interface TeacherLlm {
  /** Returns the raw `teacher_response` tool input (unvalidated). */
  /** Optional token use of this turn (Anthropic): calls, input, output, cache reads and writes. */
  /** Optional diagnostics of the last call: endpoint, ms and the attempts log. */
  info?(): { endpoint: string; ms: number; log: string[] };
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
  /** Optional: research OUTSIDE the app (spec 8.23). Only called inside the biblical context, for adults, when the app's own sources do not answer. */
  webSearch?(req: WebRequest): Promise<WebResult>;
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
  /** Fair use: answer with the fast model even if the intent would use the deep one. */
  forceFast?: boolean;
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
    /** Topic guardrail: what it decided and why (never the student's text). */
    topic?: { verdict: TopicVerdict; why: string };
    /** Research outside the app: whether it was tried, how many pages were read, whether the answer relies on them. */
    external?: { tried: boolean; sources: number; used: boolean; ms: number; reason?: string };
    retrievalMs: number;
    /** Milliseconds per stage of the retrieval (diagnostics). */
    trace?: Record<string, number>;
    route?: { endpoint: string; ms: number; log: string[] };
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

/** The question borrowed its subject from the conversation (the search text differs from what the student typed). */
const followUp0 = (searchText: string, text: string) => searchText !== text;

function fallbackResponse(name: string, verses: BibleVerse[] = [], chunks: Retrieved[] = []): TeacherResponse {
  // Something always comes back: when the model cannot answer, the teacher offers what was already found (a verse from the Bible text, never invented).
  const v = verses.find((x) => x.text && x.text.length > 20);
  const base = {
    visuals: [],
    next_options: [
      { label: "Tentar de novo", intent: "ask" as const },
      { label: "Encerrar por agora", intent: "stop" as const },
    ],
    lens_divergence: { present: false, summary: null },
    pastoral_flag: false,
    level_signal: "same" as const,
    mode_payload: null,
  };
  if (v) {
    const words = v.text.split(/\s+/);
    const text = words.slice(0, 45).join(" ") + (words.length > 45 ? "…" : "");
    const ref = formatRefPt(v.ref);
    return { ...base, speech: `${name}, a resposta completa está demorando, mas já separei a Palavra para você. ${ref}: ${text} Quer que eu tente explicar de novo?`, display_markdown: `**${ref}**\n\n${v.text}`, citations: [{ type: "bible", ref: v.ref, version_id: v.version_id ?? "por_blivre_2018" }] };
  }
  // No verse, but the search did find something in the app: show the best passage as it is (an excerpt of a real source, with its citation).
  const c = chunks.find((x) => x.text && x.text.length > 80 && x.kind !== "bible_text");
  if (c) {
    const body = c.text.replace(/^[^\n]*\n/, "").replace(/\s+/g, " ").trim();
    const words = body.split(" ");
    const excerpt = words.slice(0, 60).join(" ") + (words.length > 60 ? "…" : "");
    const label = (c.title_path ?? c.work_id).replace(/\s*\(tela:[^)]*\)/, "").slice(0, 120);
    return { ...base, speech: `${name}, a resposta completa está demorando, mas já encontrei algo nas fontes do app. ${label}: ${excerpt} Quer que eu tente explicar de novo?`, display_markdown: `**${label}**\n\n${body.slice(0, 1200)}`, citations: [{ type: "work" as const, work_id: c.work_id, chunk_id: c.id, label }] };
  }
  return { ...base, speech: `${name}, a resposta está demorando mais do que devia. Já estou tentando de novo: pode repetir a pergunta ou escolher “Tentar de novo”?`, display_markdown: "", citations: [] };
}

/** The database sometimes cancels a slow search (statement timeout) or drops a request: try once more, and if it still fails answer without library excerpts
 *  (the teacher then says plainly that it did not find the content in the sources: RA-09) instead of failing the whole turn. */
async function searchResilient(run: () => Promise<{ chunks: Retrieved[]; refs: string[] }>): Promise<{ chunks: Retrieved[]; refs: string[] }> {
  try { return await run(); } catch { /* retry below */ }
  await new Promise((r) => setTimeout(r, 400));
  try { return await run(); } catch { return { chunks: [], refs: [] }; }
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

  // 1b) Obvious injection attempts get a fixed reply without calling the model (RA-21).
  const attack = screenInput(input.text);
  if (attack) {
    const response = injectionResponse(attack, student.preferred_name);
    return {
      response,
      retrieved: [],
      meta: { ...baseMeta, intent: "ask", tier: "none", pastoral: false, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0 },
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
  const trace: Record<string, number> = {};
  // The English keywords come from a model call: it runs alongside the search, never in front of it.
  const tRw = Date.now();
  const rewriteP: Promise<string | null> = deps.rewriteQuery ? deps.rewriteQuery(searchText).then((r) => { trace.rewrite = Date.now() - tRw; return r; }).catch(() => null) : Promise.resolve(null);
  let rewritten: string | null = null;
  void rewriteP.then((r) => { rewritten = r; });
  const wantedVerses = [...mentioned, ...carriedRefs];
  // The search and the verse lookup do not depend on each other: run them together.
  const [{ chunks }, verses, layers] = await Promise.all([
    searchResilient(() => deps.search(searchText, { trace, extraQuery: rewriteP, extraRefs: carriedRefs, lenses: bible.lenses, maxTokens: deps.contextTokens, maxChunks: deps.contextTokens && deps.contextTokens < 4000 ? 8 : undefined })),
    wantedVerses.length ? deps.getVerses(bible.main_version_id, wantedVerses.slice(0, 20)) : Promise.resolve([]),
    deps.loadLayers ? deps.loadLayers().catch(() => null) : Promise.resolve(null),
  ]);

  const retrievalMs = Date.now() - tSearch;
  trace.total = retrievalMs;

  // 4b) Topic guardrail (owner's rule, 23/11/2026): the teacher answers only inside the biblical context. What is clearly outside gets a short, kind invitation back to
  // the study: no model call, no outside research. What is unclear goes on, but never to the web.
  const inStudyContext = !!input.extraSources || (!!input.mode && input.mode !== "free") || !!input.modeContext?.trail;
  const coverage = assessCoverage({ chunks, verses });
  const gate0 = topicGate({ text: input.text, refs: mentioned, chunks, followUp: followUp0(searchText, input.text), inStudyContext });
  // Unclear AND nothing in the app matches it by words and by meaning at once (so the search only brought loosely related passages): it is not a Bible question.
  // Declining kindly beats answering with random passages (capital of France, relativity, arithmetic, poems).
  const gate = gate0.verdict === "unsure" && coverage !== "ok" && !followUp0(searchText, input.text) ? { verdict: "off" as const, why: "unclear_and_library_does_not_know" } : gate0;
  if (gate.verdict === "off") {
    const response = offTopicResponse(student.preferred_name);
    memory.append(input.sessionId, { role: "user", content: input.text }, { role: "assistant", content: response.speech });
    return { response, retrieved: [], meta: { ...baseMeta, intent: "off_topic", tier: "none", pastoral: false, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0, retrievalMs, trace, topic: gate } };
  }

  // 4c) Research outside the app: only for adults (RA-22), only inside the biblical context, only in the free and deep modes, and only when the app's own collection
  // does not answer (checked before the model when nothing was found, and after it when the model says the passages do not answer).
  const canWeb = !!deps.webSearch && gate.verdict === "in" && !student.is_minor && (!input.mode || input.mode === "free" || input.mode === "deep");
  let external: WebSource[] = [];
  let externalTried = false, externalMs = 0;
  let externalErrors: string[] = [];
  let externalNotes: string[] = [];
  const runWeb = async () => {
    externalTried = true;
    const tw = Date.now();
    // the English keywords (from the model) help to find the English article; wait for them a moment, no longer
    const english = rewritten ?? (await Promise.race([rewriteP, new Promise<null>((r) => setTimeout(() => r(null), 1500))]).catch(() => null));
    const found: WebResult = await deps.webSearch!({ question: input.text, english, context: searchText === input.text ? undefined : searchText }).catch((e: Error) => ({ sources: [] as WebSource[], errors: [`websearch:${String(e?.message).slice(0, 60)}`] }));
    external = found.sources;
    externalErrors = found.errors;
    externalNotes = found.notes ?? [];
    externalMs = Date.now() - tw;
  };
  if (canWeb && coverage !== "ok") await runWeb();

  // 5) Prompt and 6) generation.
  const deepNote = DEEP_INTENTS.includes(intent)
    ? "MODO APROFUNDAR: o aluno quer a análise detalhada. Coloque o detalhamento em display_markdown (títulos curtos e listas, até 250 palavras por bloco, só com o que está nos trechos) e use speech para um resumo falado de até 250 palavras que convide a continuar. Se os trechos não cobrirem algum ponto, diga qual."
    : "";
  const baseNotice = groundingNotice(findUngroundedNames({ question: input.text, chunkTexts: [...chunks.map((c) => c.text), ...verses.map((v) => v.text)], rewritten }));
  const unsureNote = gate.verdict === "unsure" ? UNSURE_NOTICE : "";
  const noticeFor = (ext: WebSource[]) => [baseNotice, deepNote, unsureNote, externalPrompt(ext)].filter(Boolean).join("\n\n") || undefined;
  const notice = () => noticeFor(external); // read at each use: the outside research may arrive after the first attempt
  const small = !!deps.contextTokens && deps.contextTokens < 4000;
  const maxChunkChars = small ? 1300 : undefined;
  let parts = buildSystemParts({ student, bible, chunks, verses, notice: [notice(), input.extraSources].filter(Boolean).join("\n\n") || undefined, maxChunkChars, layers, mode: input.mode, modeContext: input.modeContext, sermonTypeDefinition: input.sermonTypeDefinition });
  const joined = () => `${parts.stable}\n\n---\n\n${parts.dynamic}`;
  // On "request too large" (free-tier token limits) retry once with half of the retrieved context.
  let lastRaw: unknown = null;
  const generate = async (msgs: ChatMessage[]) => {
    try {
      return (lastRaw = normalizeRaw(await deps.llm.generate({ system: joined(), systemParts: parts, messages: msgs, tier }), bible.main_version_id));
    } catch (e) {
      if (!/413/.test((e as Error).message)) throw e;
      parts = buildSystemParts({ student, bible, chunks: chunks.slice(0, Math.max(2, Math.ceil(chunks.length / 2))), verses: verses.slice(0, 10), notice: notice(), maxChunkChars, layers, mode: input.mode, modeContext: input.modeContext, sermonTypeDefinition: input.sermonTypeDefinition });
      return (lastRaw = normalizeRaw(await deps.llm.generate({ system: joined(), systemParts: parts, messages: msgs, tier }), bible.main_version_id));
    }
  };
  const history = priorHistory.slice(-(deps.historyMessages ?? 24));
  const messages: ChatMessage[] = [...history, { role: "user", content: input.text }];
  const tier = input.forceFast ? "fast" : selectTier({ intent, mode: input.mode, lenses: bible.lenses });

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
    const response = fallbackResponse(student.preferred_name, verses, chunks);
    return { response, retrieved: [], meta: { ...baseMeta, intent, tier, pastoral: false, words: countWords(response.speech), overWordLimit: false, latencyMs: Date.now() - t0, degraded: true, degradedReason: (e as Error).message.slice(0, 80), retrievalMs, trace, route: deps.llm.info?.() } };
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
  // 6b) The model says the app's passages do not answer (or admits it did not find the answer): research outside the app, once, and answer again with those pages.
  if (canWeb && !externalTried && (parsed.data.sources_sufficient === false || looksUnanswered(parsed.data.speech))) {
    await runWeb();
    if (external.length) {
      parts = buildSystemParts({ student, bible, chunks, verses, notice: [notice(), input.extraSources].filter(Boolean).join("\n\n") || undefined, maxChunkChars, layers, mode: input.mode, modeContext: input.modeContext, sermonTypeDefinition: input.sermonTypeDefinition });
      const againRaw = await tryGenerate(messages);
      const again = againRaw ? teacherResponseSchema.safeParse(againRaw) : null;
      if (again?.success) parsed = again;
    }
  }
  // 6c) Numbers and measures spoken from outside pages must be in those pages (RA-09: never invent a number). One more attempt, then the plain words of the source.
  if (external.length && usesOutside(parsed.data.speech, external)) {
    let bad = ungroundedNumbers(parsed.data.speech, external, [input.text, ...chunks.map((c) => c.text), ...verses.map((v) => v.text)]);
    if (bad.length) {
      const hint = `Atenção: você falou números que não estão nas passagens externas (${bad.join(", ")}). Refaça usando exatamente os números que as passagens trazem, citando de qual fonte vem cada um.`;
      const fixedRaw = await tryGenerate([...messages, { role: "user", content: hint }]);
      const fixed = fixedRaw ? teacherResponseSchema.safeParse(fixedRaw) : null;
      if (fixed?.success) parsed = fixed;
      bad = ungroundedNumbers(parsed.data.speech, external, [input.text, ...chunks.map((c) => c.text), ...verses.map((v) => v.text)]);
    }
    if (bad.length) {
      const first = external[0];
      parsed = teacherResponseSchema.safeParse({ ...parsed.data, speech: `${student.preferred_name}, pesquisei fora do app, em ${first.site}, no artigo "${first.title}", mas não consegui conferir esse número com segurança. Prefere que eu leia o trecho da fonte para você?`, display_markdown: first.passages.slice(0, 3).map((p) => `- ${p}`).join("\n") }) as typeof parsed;
    }
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
  // Visuals: only catalog ids reach the screen (max 2 per turn).
  // An answer that copies the internal instructions is replaced by the fixed reply.
  if (leaksPrompt(`${ver.response.speech} ${ver.response.display_markdown ?? ""}`)) ver = { ...ver, response: injectionResponse("reveal_prompt", student.preferred_name) };
  // The answer that relies on outside pages must SAY so and carry the sources (spec 8.23): the label is added here when the model forgot it; sources go in only when used.
  const usedOutside = external.length > 0 && usesOutside(ver.response.speech, external);
  let speech = ver.response.speech;
  if (usedOutside && !/n[ãa]o est[áa] no acervo|fora do app/i.test(speech)) speech = `${outsideLabel(external)} ${speech}`;
  const response = { ...ver.response, speech: ensureClosingQuestion(speech), visuals: sanitizeVisuals(ver.response.visuals as never) as typeof ver.response.visuals, external_sources: usedOutside ? toResponseSources(external) : [] };
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
      topic: gate,
      external: { tried: externalTried, sources: external.length, used: usedOutside, ms: externalMs, ...(externalTried && !external.length ? { reason: (externalErrors.length ? externalErrors.join("; ") : `no_pages ${externalNotes.join(" ")}`.trim()).slice(0, 240) } : {}) },
      removedCitations: ver.removed.length,
      schemaRetries,
      speechRewrites: speechRewrites + lengthRewrites,
      words,
      overWordLimit: words > limit,
      latencyMs: Date.now() - t0,
      retrievalMs,
      trace,
      route: deps.llm.info?.(),
      llmMs,
      llm: deps.llm.stats?.(),
      ...(textFallback ? { textFallback: true } : {}),
    },
  };
}
