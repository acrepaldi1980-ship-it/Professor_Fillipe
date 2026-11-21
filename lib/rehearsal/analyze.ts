// Sermon rehearsal analysis (spec 8.7.5). The numbers (time, pace, pauses, language crutches) are computed here from the timed transcript, not
// by the model; the model only judges what needs reading (central idea, transitions, illustrations, fidelity to the text) and places the parts
// of the outline in the transcript. Pure functions: easy to test.
import { z } from "zod";

export interface Segment { start: number; end: number; text: string }
export interface OutlinePart { key: string; label: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const countWords = (s: string) => (s.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

/** Crutch words: certain ones are always counted; connectors only matter when used a lot. Whisper often drops "éé"/"hum", so this undercounts. */
const CRUTCHES: { word: string; kind: "crutch" | "connector"; re: RegExp }[] = [
  { word: "né", kind: "crutch", re: /\bne\b/g },
  { word: "tipo", kind: "crutch", re: /\btipo\b/g },
  { word: "hum", kind: "crutch", re: /\b(hum+|hmm+|ahn?|ehn?|ee+h?)\b/g },
  { word: "tá", kind: "crutch", re: /\bta\b/g },
  { word: "entendeu", kind: "crutch", re: /\bentendeu\b/g },
  { word: "então", kind: "connector", re: /\bentao\b/g },
  { word: "aí", kind: "connector", re: /\bai\b/g },
  { word: "assim", kind: "connector", re: /\bassim\b/g },
  { word: "bom", kind: "connector", re: /\bbom\b/g },
  { word: "enfim", kind: "connector", re: /\benfim\b/g },
  { word: "certo", kind: "connector", re: /\bcerto\b/g },
];

export interface Metrics {
  total_seconds: number;
  speaking_seconds: number;
  words: number;
  /** Words per minute of actual speech (pauses left out). */
  wpm: number;
  /** Words per minute over the whole recording. */
  wpm_overall: number;
  pauses: { count: number; longest_seconds: number; total_seconds: number };
  crutches: { word: string; count: number; per_100_words: number; flagged: boolean }[];
}

export function computeMetrics(segments: Segment[], text: string): Metrics {
  const words = countWords(text);
  const first = segments[0]?.start ?? 0;
  const last = segments.length ? Math.max(...segments.map((s) => s.end)) : 0;
  const total = Math.max(0, last - first);
  const speaking = segments.reduce((n, s) => n + Math.max(0, s.end - s.start), 0);
  let count = 0, longest = 0, sum = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap >= 2.5) { count++; sum += gap; longest = Math.max(longest, gap); }
  }
  const n = norm(text);
  const crutches = CRUTCHES.map((c) => {
    const k = (n.match(c.re) ?? []).length;
    const per = words ? (k / words) * 100 : 0;
    const flagged = c.kind === "crutch" ? k >= 3 && per >= 0.5 : k >= 6 && per >= 2;
    return { word: c.word, count: k, per_100_words: Math.round(per * 10) / 10, flagged };
  }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);
  return {
    total_seconds: Math.round(total),
    speaking_seconds: Math.round(speaking),
    words,
    wpm: speaking > 1 ? Math.round(words / (speaking / 60)) : 0,
    wpm_overall: total > 1 ? Math.round(words / (total / 60)) : 0,
    pauses: { count, longest_seconds: Math.round(longest * 10) / 10, total_seconds: Math.round(sum) },
    crutches,
  };
}

/** Comfortable range for preaching in Portuguese (editorial reference, not a rule): below is slow, above is rushed. */
export const WPM_RANGE = { low: 100, high: 150 };
export const paceLabel = (wpm: number): "slow" | "ok" | "fast" | "unknown" => (!wpm ? "unknown" : wpm < WPM_RANGE.low ? "slow" : wpm > WPM_RANGE.high ? "fast" : "ok");

// ---- feedback (model output, validated) ----
const text = z.string().trim().min(1).max(600);
export const Feedback = z.object({
  central_idea: z.object({ stated_early: z.boolean(), clarity: z.number().int().min(1).max(5), comment: text }),
  transitions: z.object({ score: z.number().int().min(1).max(5), comment: text }),
  illustrations: z.object({ used: z.array(z.string().trim().max(200)).max(6).default([]), comment: text }),
  fidelity: z.object({ score: z.number().int().min(1).max(5), comment: text, issues: z.array(z.string().trim().max(300)).max(5).default([]) }),
  strengths: z.array(text).min(1).max(3),
  improvements: z.array(z.object({ what: text, how: text })).max(3),
});
export type Feedback = z.infer<typeof Feedback>;

export const PartPlacement = z.object({ part: z.string(), from: z.number().int().min(0).nullable(), to: z.number().int().min(0).nullable() });
export const ModelAnalysis = z.object({ feedback: Feedback, parts: z.array(PartPlacement).max(12).default([]) });

export interface PartTime { key: string; label: string; seconds: number | null; words: number | null; found: boolean }

/** Time and words of each outline part from the placement the model gave (segment indexes). Anything out of range counts as not found. */
export function partTimes(parts: OutlinePart[], placement: z.infer<typeof PartPlacement>[], segments: Segment[]): PartTime[] {
  return parts.map((p) => {
    const m = placement.find((x) => x.part === p.key);
    if (!m || m.from === null || m.to === null || m.from > m.to || m.to >= segments.length) return { ...p, seconds: null, words: null, found: false };
    const seg = segments.slice(m.from, m.to + 1);
    return { ...p, seconds: Math.round(segments[m.to].end - segments[m.from].start), words: countWords(seg.map((s) => s.text).join(" ")), found: true };
  });
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Outline parts that exist, in the order a sermon is delivered. */
export function outlineParts(o: { introduction?: string; divisions?: { title: string }[]; conclusion?: string; appeal?: string }): OutlinePart[] {
  const parts: OutlinePart[] = [];
  if (o.introduction) parts.push({ key: "introduction", label: "Introdução" });
  (o.divisions ?? []).forEach((d, i) => parts.push({ key: `division-${i + 1}`, label: `${i + 1}. ${d.title}` }));
  if (o.conclusion) parts.push({ key: "conclusion", label: "Conclusão" });
  if (o.appeal) parts.push({ key: "appeal", label: "Apelo" });
  return parts;
}

export function buildPrompt(args: { outline: Record<string, unknown>; parts: OutlinePart[]; passage: string; segments: Segment[]; metrics: Metrics }) {
  const { outline, parts, passage, segments, metrics } = args;
  const lines = segments.map((s, i) => `[${i}|${fmtTime(s.start)}] ${s.text}`).join("\n").slice(0, 26000);
  const system = [
    "Você é o Professor Filipe, professor de homilética acolhedor e honesto, e analisa o ensaio de um sermão que o pregador fez em voz alta.",
    "Você recebe o esboço que o pregador preparou, o texto bíblico base e a transcrição do ensaio com marcação de tempo.",
    "Avalie SÓ com base no que está na transcrição e no esboço. Não invente o que o pregador disse; não cite versículos que não foram dados; não escreva o sermão por ele.",
    "Fale com o pregador por 'você', em português do Brasil, de forma concreta e gentil, sem elogio vazio.",
    "Devolva JSON com: feedback { central_idea { stated_early, clarity 1-5, comment }, transitions { score 1-5, comment }, illustrations { used[], comment }, fidelity { score 1-5, comment, issues[] }, strengths (exatamente 3), improvements (até 3, cada uma com what e how, concretas e aplicáveis) } e parts [{ part, from, to }].",
    "central_idea: a ideia central do esboço aparece cedo e é repetida de forma clara? transitions: o pregador avisa a passagem de uma parte para outra? illustrations: quais ilustrações ou exemplos usou e se ajudam a ideia. fidelity: o que disse confere com o texto bíblico base e com o esboço; liste desvios em issues.",
    `parts: para cada parte do esboço (${parts.map((p) => `"${p.key}" = ${p.label}`).join("; ")}) dê from e to = índices (números entre colchetes) do primeiro e do último trecho da transcrição em que ela é dita; use null nos dois se a parte não foi pregada.`,
  ].join("\n");
  const user = [
    `ESBOÇO:\n${JSON.stringify(outline).slice(0, 5000)}`,
    passage ? `TEXTO BÍBLICO BASE:\n${passage.slice(0, 2500)}` : "",
    `NÚMEROS MEDIDOS (já calculados; não recalcule): ${metrics.words} palavras, ${fmtTime(metrics.total_seconds)} no total, ${metrics.wpm} palavras por minuto, ${metrics.pauses.count} pausas longas, vícios: ${metrics.crutches.map((c) => `${c.word} ${c.count}x`).join(", ") || "nenhum relevante"}.`,
    `TRANSCRIÇÃO [índice|tempo]:\n${lines}`,
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

// ---- comparison between two rehearsals of the same outline ----
export interface RehearsalLite { id: string; created_at: string; metrics: Metrics; feedback: Partial<Feedback>; parts?: PartTime[] }
export interface Delta { label: string; before: number | null; after: number | null; unit: string; better: "up" | "down" | "none" }

export function compareRehearsals(a: RehearsalLite, b: RehearsalLite): { deltas: Delta[]; partDeltas: { label: string; before: number | null; after: number | null }[]; addressed: string[] } {
  const crut = (r: RehearsalLite) => r.metrics.crutches.filter((c) => c.flagged).reduce((n, c) => n + c.count, 0);
  const deltas: Delta[] = [
    { label: "total", before: a.metrics.total_seconds, after: b.metrics.total_seconds, unit: "s", better: "none" },
    { label: "wpm", before: a.metrics.wpm, after: b.metrics.wpm, unit: "ppm", better: "none" },
    { label: "pauses", before: a.metrics.pauses.count, after: b.metrics.pauses.count, unit: "", better: "down" },
    { label: "crutches", before: crut(a), after: crut(b), unit: "", better: "down" },
    { label: "central_idea", before: a.feedback.central_idea?.clarity ?? null, after: b.feedback.central_idea?.clarity ?? null, unit: "/5", better: "up" },
    { label: "transitions", before: a.feedback.transitions?.score ?? null, after: b.feedback.transitions?.score ?? null, unit: "/5", better: "up" },
    { label: "fidelity", before: a.feedback.fidelity?.score ?? null, after: b.feedback.fidelity?.score ?? null, unit: "/5", better: "up" },
  ];
  const partDeltas = (b.parts ?? []).map((p) => ({ label: p.label, before: a.parts?.find((x) => x.key === p.key)?.seconds ?? null, after: p.seconds }));
  // Improvements asked in the earlier rehearsal: listed so the preacher checks whether the new one fixed them.
  const addressed = (a.feedback.improvements ?? []).map((i) => i.what);
  return { deltas, partDeltas, addressed };
}
