// Session closing (RF-M09-01): a spoken summary (up to 300 words, about 2 minutes), a mind map (nodes and links, drawn as a diagram)
// and 3 to 7 review cards, from one short model call over what was said. Nothing here invents content: the model only organizes the session.
import { z } from "zod";
import type { NotesLlm } from "../notes/llm";

export const MindMap = z.object({
  nodes: z.array(z.object({ id: z.string().max(20), label: z.string().min(1).max(60), group: z.enum(["center", "topic", "detail"]).default("topic") })).min(3).max(14),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().max(40).optional() })).max(20),
});
export type MindMap = z.infer<typeof MindMap>;

export const ReviewCardDraft = z.object({ question: z.string().min(8).max(220), answer: z.string().min(2).max(300), ref: z.string().max(40).optional() });
export const Closing = z.object({
  summary: z.string().min(40).max(2600),
  mind_map: MindMap,
  cards: z.array(ReviewCardDraft).min(3).max(7),
  topics: z.array(z.string().max(60)).max(6).default([]),
  level_signal: z.enum(["lower", "same", "higher"]).default("same"),
});
export type Closing = z.infer<typeof Closing>;

const SYSTEM = `Você fecha uma sessão de estudo bíblico entre o Professor Filipe (IA) e um aluno, em português do Brasil. Use SOMENTE o que foi dito na conversa; não acrescente fatos.
Responda SOMENTE com JSON: {"summary": "...", "mind_map": {"nodes":[{"id":"n1","label":"...","group":"center|topic|detail"}], "edges":[{"from":"n1","to":"n2","label":"..."}]}, "cards": [{"question":"...","answer":"...","ref":"ACT.8.30"}], "topics": ["..."], "level_signal": "lower|same|higher"}.
- summary: fala do professor para ser ouvida, em até 280 palavras: o que o aluno estudou, os pontos principais e um desafio prático. Trate o aluno pelo nome. Sem listas.
- mind_map: de 5 a 12 nós; um nó "center" com o tema; nós "topic" para as ideias principais; "detail" para versículos e fatos. Todo nó ligado ao mapa.
- cards: de 3 a 7 cartões que testem COMPREENSÃO (por quê, como, o que significa), não só memorização. answer em até 35 palavras. ref só se a conversa citou um versículo (formato "ACT.8.30").
- topics: até 5 temas ou passagens. level_signal: "higher" se o aluno mostrou mais conhecimento que o esperado, "lower" se teve dificuldade, senão "same".`;

const clean = (raw: string) => {
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  return JSON.parse(a >= 0 ? raw.slice(a, b + 1) : raw);
};

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export async function generateClosing(turns: { role: "user" | "teacher"; text: string }[], name: string, llm: NotesLlm): Promise<Closing | null> {
  const convo = turns.slice(-24).map((t) => `${t.role === "user" ? "Aluno" : "Professor"}: ${t.text.slice(0, 600)}`).join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await llm.complete(SYSTEM, `Nome do aluno: ${name}\n\nCONVERSA:\n${convo}${attempt ? "\n\nLembrete: responda somente com o JSON pedido, summary com até 280 palavras." : ""}`, 1800);
      const parsed = Closing.safeParse(clean(raw));
      if (!parsed.success || words(parsed.data.summary) > 320) continue;
      const ids = new Set(parsed.data.mind_map.nodes.map((n) => n.id));
      // keep only links between existing nodes
      const edges = parsed.data.mind_map.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
      return { ...parsed.data, mind_map: { ...parsed.data.mind_map, edges } };
    } catch {
      /* retry once */
    }
  }
  return null;
}

// ---- grading a spoken answer (RF-M09-03) ----
export const Evaluation = z.object({ verdict: z.enum(["wrong", "partial", "right"]), feedback: z.string().min(3).max(400) });
export type Evaluation = z.infer<typeof Evaluation>;

const EVAL_SYSTEM = `Você é o Professor Filipe corrigindo, em tom de conversa, a resposta de um aluno a uma pergunta de revisão. Compare a resposta do aluno com a RESPOSTA ESPERADA (o sentido, não as palavras exatas).
Responda SOMENTE com JSON: {"verdict":"wrong|partial|right","feedback":"..."}.
right: o essencial está certo. partial: parte certa, falta algo importante. wrong: errou ou não soube.
feedback: até 35 palavras, acolhedor, trata o aluno pelo nome; se errou ou faltou algo, diga em uma frase o que era; nunca humilhe.`;

/** Offline fallback when no model answers: share of the expected answer's key words found in the student's answer. */
export function heuristicVerdict(expected: string, given: string): Verdict3 {
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  const exp = [...new Set(fold(expected))];
  if (!exp.length || !given.trim()) return "wrong";
  const g = new Set(fold(given));
  const share = exp.filter((w) => g.has(w) || [...g].some((x) => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))).length / exp.length;
  return share >= 0.6 ? "right" : share >= 0.3 ? "partial" : "wrong";
}
type Verdict3 = "wrong" | "partial" | "right";

export async function evaluateAnswer(card: { question: string; answer: string }, given: string, name: string, llm: NotesLlm): Promise<Evaluation> {
  try {
    const raw = await llm.complete(EVAL_SYSTEM, `Aluno: ${name}\nPERGUNTA: ${card.question}\nRESPOSTA ESPERADA: ${card.answer}\nRESPOSTA DO ALUNO: ${given.slice(0, 800)}`, 300);
    const parsed = Evaluation.safeParse(clean(raw));
    if (parsed.success) return parsed.data;
  } catch {
    /* fall through to the heuristic */
  }
  const verdict = heuristicVerdict(card.answer, given);
  const feedback = verdict === "right" ? `Isso mesmo, ${name}!` : verdict === "partial" ? `Quase, ${name}. A resposta completa é: ${card.answer}` : `Sem problema, ${name}. A resposta é: ${card.answer}`;
  return { verdict, feedback };
}
