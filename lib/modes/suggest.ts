// One-section suggestions for the lesson plan and the sermon outline (RA-10: the teacher proposes, the person edits and decides).
// A dedicated, small request per section: it does not depend on the chat answer carrying `mode_payload`, so it also works with the
// free fallback model, and it is cheap. Bible references in the answer are checked against the Bible text; unknown ones are dropped.
import Anthropic from "@anthropic-ai/sdk";
import { BOOKS } from "../knowledge/books";
import { groqModels } from "../teacher/groq";
import { findReferences, formatRefPt } from "../knowledge/refs-parser";
import { LessonPlan, SermonOutline } from "./schema";

export type SuggestMode = "lesson" | "sermon";
export interface SuggestInput {
  mode: SuggestMode;
  context: Record<string, unknown>;
  doc: Record<string, unknown>;
  /** objective, icebreaker, ... for the lesson; central_idea, introduction, division, division_application:N, division_texts:N, conclusion, appeal for the sermon. */
  section: string;
  sermonTypeDefinition?: string;
  /** Real text the answer must rest on (the Bible passage, or retrieved excerpts). */
  sources?: string;
}
export type JsonLlm = (system: string, user: string) => Promise<unknown>;

const LESSON_FORMAT: Record<string, string> = {
  objective: '{"content": ["objetivo 1", "objetivo 2"]} (até 3 frases, cada uma com verbo observável)',
  icebreaker: '{"content": "texto do quebra-gelo, 2 a 4 frases"}',
  context: '{"content": "contexto histórico e literário do texto, 4 a 6 frases"}',
  points: '{"content": [{"title": "...", "verses": ["ACT.8.30"], "explanation": "...", "illustration": "..."}]} (3 a 5 pontos)',
  dynamic: '{"content": "uma dinâmica para a turma, com passo a passo curto"}',
  questions: '{"content": ["pergunta 1", "pergunta 2"]} (4 a 8 perguntas de discussão)',
  application: '{"content": "aplicação prática para a semana, 2 a 4 frases"}',
  memory_verse: '{"content": "ACT.8.30"} (só a referência de UM versículo, no formato LIVRO.CAP.VERSO)',
};
const SERMON_FORMAT: Record<string, string> = {
  central_idea: '{"content": "uma frase com a ideia central"}',
  introduction: '{"content": "introdução com um gancho, 3 a 5 frases"}',
  division: '{"content": {"title": "...", "texts": ["ACT.8.26"], "explanation": "...", "illustration": "...", "application": "..."}}',
  conclusion: '{"content": "conclusão, 3 a 4 frases"}',
  appeal: '{"content": "apelo final, 2 a 3 frases"}',
};

export function isValidSection(mode: SuggestMode, section: string): boolean {
  if (mode === "lesson") return section in LESSON_FORMAT;
  const base = section.split(":")[0];
  return base in SERMON_FORMAT || base === "division_application" || base === "division_texts";
}

export function buildPrompt(i: SuggestInput): { system: string; user: string } {
  const c = i.context;
  const rules = `Você é o Professor Filipe, parceiro de quem prepara ${i.mode === "lesson" ? "uma aula de EBD" : "um sermão"}. Escreva em português do Brasil, simples e direto, como um amigo que ajuda. Regras: use só o que está na Bíblia; NÃO invente versículos, citações, autores, datas nem números; não copie versículos por extenso (cite a referência); não escreva a peça inteira, só a seção pedida; referências bíblicas sempre no formato LIVRO.CAP.VERSO, por exemplo ACT.8.30 ou ACT.8.26-ACT.8.40. Nos textos corridos escreva as referências por extenso ("Atos 8:26-40"), NUNCA códigos como ACT.8.26; só nas listas de versículos use o código. Baseie-se APENAS nas FONTES abaixo; se algo não estiver nas fontes, não afirme. Responda SOMENTE com um objeto JSON, sem texto fora dele.`;
  const setup = i.mode === "lesson"
    ? `Aula: tema "${c.topic ?? ""}", texto-base "${c.ref ?? "escolha o mais adequado ao tema"}", turma "${c.age_group ?? "mista"}", ${c.minutes ?? 45} minutos${c.magazine ? `, revista "${c.magazine}"` : ""}.`
    : `Sermão ${c.sermon_type ?? "temático"}${i.sermonTypeDefinition ? ` (${i.sermonTypeDefinition})` : ""}; texto ou tema: "${c.ref_or_theme ?? ""}".`;
  const base = i.section.split(":")[0];
  const idx = Number(i.section.split(":")[1] ?? NaN);
  let ask: string;
  if (i.mode === "lesson") ask = `Proponha a seção "${i.section}". Formato: ${LESSON_FORMAT[i.section]}`;
  else if (base === "division_application" || base === "division_texts") ask = `Para a divisão ${idx + 1} do esboço, proponha ${base === "division_application" ? "a aplicação" : "os textos bíblicos (lista de referências)"}. Formato: {"content": ${base === "division_application" ? '"texto da aplicação"' : '["ACT.8.26"]'}}`;
  else ask = `Proponha ${base === "division" ? `a divisão número ${(Array.isArray((i.doc as { divisions?: unknown[] }).divisions) ? (i.doc as { divisions: unknown[] }).divisions.length : 0) + 1}` : `a seção "${base}"`}. Formato: ${SERMON_FORMAT[base]}`;
  const src = i.sources ? `\nFONTES (a única base permitida):\n${i.sources.slice(0, 6000)}\n` : "";
  return { system: rules, user: `${setup}${src}\nO que já está no documento (JSON): ${JSON.stringify(i.doc).slice(0, 3000)}\n\n${ask}` };
}

/** Checks the Bible references in a suggestion; unknown ones are removed. `exists` receives the first verse of each reference. */
async function cleanRefs(refs: unknown, exists: (verse: string) => Promise<boolean>): Promise<string[]> {
  const list = Array.isArray(refs) ? refs.filter((r): r is string => typeof r === "string") : typeof refs === "string" ? [refs] : [];
  const out: string[] = [];
  for (const raw of list) {
    // canonical (ACT.8.30, ACT.8.26-ACT.8.40) or written in Portuguese ("Atos 8:30")
    const ref = /^[0-9A-Z]{3}\.\d+\.\d+/.test(raw.trim()) ? raw.trim() : findReferences(raw).flatMap((r) => r.refs)[0];
    if (ref && (await exists(ref.split("-")[0]))) out.push(ref);
  }
  return out.slice(0, 8);
}

/** Codes such as ACT.8.26 or ACT.8.26-ACT.8.40 in running text become "Atos 8:26" / "Atos 8:26-40"; invented codes (AT.8.26) are removed. */
export function humanizeRefs(text: string): string {
  return text
    .replace(/\s*\(\s*([A-Z0-9]{2,3}\.\d+\.\d+(?:-[A-Z0-9]{2,3}\.\d+\.\d+)?)\s*\)/g, (_m, r: string) => { const f = safeFormat(r); return f ? ` (${f})` : ""; })
    .replace(/\b[A-Z0-9]{2,3}\.\d+\.\d+(?:-[A-Z0-9]{2,3}\.\d+\.\d+)?\b/g, (r) => safeFormat(r) ?? "");
}
function safeFormat(r: string): string | null {
  const codes = r.split("-").map((x) => x.split(".")[0]);
  if (!codes.every((c) => BOOKS.some((b) => b.code === c))) return null; // an invented book code (AT.8.26)
  try { const f = formatRefPt(r); return f && !/\./.test(f) ? f : null; } catch { return null; }
}
function cleanText(v: unknown): unknown {
  if (typeof v === "string") return humanizeRefs(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? humanizeRefs(x) : x));
  return v;
}

/** Returns the new document and what was written, or null when the answer did not fit the section. */
export async function suggestSection(i: SuggestInput, llm: JsonLlm, exists: (verse: string) => Promise<boolean>): Promise<{ doc: Record<string, unknown>; content: unknown } | null> {
  if (!isValidSection(i.mode, i.section)) return null;
  const { system, user } = buildPrompt(i);
  const raw = (await llm(system, user)) as { content?: unknown } | null;
  let content = raw && typeof raw === "object" ? raw.content : undefined;
  if (content === undefined || content === null || content === "") return null;
  const base = i.section.split(":")[0];
  const idx = Number(i.section.split(":")[1] ?? NaN);
  if (i.section !== "memory_verse" && i.section !== "points" && base !== "division" && base !== "division_texts") content = cleanText(content);

  if (i.mode === "lesson") {
    if (i.section === "points" && Array.isArray(content)) {
      content = await Promise.all(content.slice(0, 5).map(async (p: { title?: string; verses?: unknown; explanation?: string; illustration?: string }) => ({ title: String(p.title ?? "").slice(0, 200), verses: await cleanRefs(p.verses, exists), explanation: humanizeRefs(String(p.explanation ?? "")).slice(0, 1500), ...(p.illustration ? { illustration: humanizeRefs(String(p.illustration)).slice(0, 1000) } : {}) })));
    }
    if (i.section === "memory_verse") { const r = await cleanRefs(content, exists); if (!r.length) return null; content = r[0]; }
    const next = LessonPlan.safeParse({ ...i.doc, [i.section]: content });
    return next.success ? { doc: next.data, content } : null;
  }

  const divisions = [...(((i.doc as { divisions?: Record<string, unknown>[] }).divisions) ?? [])];
  if (base === "division") {
    const d = (content ?? {}) as { title?: string; texts?: unknown; explanation?: string; illustration?: string; application?: string };
    divisions.push({ title: String(d.title ?? "").slice(0, 200), texts: await cleanRefs(d.texts, exists), explanation: humanizeRefs(String(d.explanation ?? "")).slice(0, 1500), ...(d.illustration ? { illustration: humanizeRefs(String(d.illustration)).slice(0, 1000) } : {}), ...(d.application ? { application: humanizeRefs(String(d.application)).slice(0, 1000) } : {}) });
    const next = SermonOutline.safeParse({ ...i.doc, divisions });
    return next.success ? { doc: next.data, content: divisions[divisions.length - 1] } : null;
  }
  if (base === "division_application" || base === "division_texts") {
    if (!divisions[idx]) return null;
    divisions[idx] = base === "division_application" ? { ...divisions[idx], application: humanizeRefs(String(content)).slice(0, 1000) } : { ...divisions[idx], texts: await cleanRefs(content, exists) };
    const next = SermonOutline.safeParse({ ...i.doc, divisions });
    return next.success ? { doc: next.data, content: divisions[idx] } : null;
  }
  const next = SermonOutline.safeParse({ ...i.doc, [base]: content });
  return next.success ? { doc: next.data, content } : null;
}

// ---- the real model call (Claude when available, the free Groq models otherwise) ----
function parseJson(text: string): unknown {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function callJsonLlm(system: string, user: string): Promise<unknown> {
  if (process.env.ANTHROPIC_API_KEY && process.env.TEACHER_LLM_PROVIDER !== "groq") {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await client.messages.create({ model: process.env.TEACHER_MODEL_FAST ?? "claude-sonnet-5-5", max_tokens: 1800, system, messages: [{ role: "user", content: user }], output_config: { effort: "low" }, thinking: { type: "between_tools" } as never });
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const j = parseJson(text);
      if (j) return j;
    } catch (e) {
      if (!process.env.GROQ_API_KEY || !/credit|billing|\b(402|429|500|502|503|529)\b|overloaded|rate/i.test((e as Error).message ?? "")) throw e;
    }
  }
  const models = groqModels();
  let last = 0;
  for (let round = 0; round < 3; round++) {
    let wait = 0;
    let limited = false;
    for (const model of models) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(40000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY ?? "proxy-injected"}` },
        body: JSON.stringify({ model, temperature: 0.5, response_format: { type: "json_object" }, ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}), messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      last = res.status;
      if (res.status === 429) { limited = true; wait = Math.max(wait, Number(res.headers.get("retry-after")) || 0); }
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const j = parseJson(json.choices?.[0]?.message?.content ?? "");
      if (j) return j;
    }
    if (limited && round < 2) { last = 429; await new Promise((r) => setTimeout(r, Math.min(10, Math.max(4, wait)) * 1000)); } else break;
  }
  throw new Error(`suggest_failed_${last || "empty"}`);
}
