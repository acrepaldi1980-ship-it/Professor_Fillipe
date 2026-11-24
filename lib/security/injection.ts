// Prompt-injection defenses (spec 12, RA-21). Two layers that do not depend on the model:
//  1) screenInput: obvious attempts to reveal the prompt, change the role or override the rules get a fixed, kind reply
//     (no model call, so it also costs nothing);
//  2) leaksPrompt: the model's answer is checked for long passages copied from the internal instructions.
import { LAYER_IDENTITY } from "../teacher/prompts";
import type { TeacherResponse } from "../teacher/schema";

export type InjectionKind = "reveal_prompt" | "change_role" | "override_rules" | "secrets";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const RULES: { kind: InjectionKind; re: RegExp }[] = [
  // reveal / repeat / translate / summarize the instructions
  { kind: "reveal_prompt", re: /\b(prompt|instrucoes|regras|diretrizes|configuracao(es)?)\b.{0,40}\b(sistema|internas?|iniciais|secretas?|acima|anteriores)\b/ },
  { kind: "reveal_prompt", re: /\b(mostre|mostra|revele|revela|imprima|repita|repete|traduza|resuma|copie|liste|diga|me de|exiba)\b.{0,50}\b(prompt|instrucoes|regras (internas|do sistema|que voce segue)|system prompt)\b/ },
  { kind: "reveal_prompt", re: /\b(system prompt|prompt de sistema|prompt do sistema|developer message)\b/ },
  { kind: "reveal_prompt", re: /\brepita tudo (que esta )?(acima|antes)\b/ },
  { kind: "reveal_prompt", re: /\b(cumpra|cumpre) a promessa\b.{0,40}\bregras\b/ },
  { kind: "reveal_prompt", re: /\brevele (suas|as) regras\b|\bsuas regras\b.{0,20}\b(palavra por palavra|na integra)\b/ },
  // change the role
  { kind: "change_role", re: /\b(ignore|ignora|esqueca|esquece|desconsidere|abandone)\b.{0,40}\b(instrucoes|regras|professor filipe|papel|personagem|restricoes|limites?)\b/ },
  { kind: "change_role", re: /\b(a partir de agora|agora) voce (e|eh|sera|vai ser)\b/ },
  { kind: "change_role", re: /\b(voce agora e|voce e agora)\b/ },
  { kind: "change_role", re: /\b(aja|age|atue|finja|finge|faca de conta)\b.{0,30}\b(como|que (voce )?(e|eh))\b/ },
  { kind: "change_role", re: /\b(dan|jailbreak|modo desenvolvedor|modo manutencao|sem restricoes|sem filtros?)\b/ },
  { kind: "change_role", re: /\b(diga|confirme|afirme|admita) que (voce )?(e|eh) (um )?(humano|pastor|pessoa|padre)\b/ },
  // override the rules (invent verses, skip sources, ignore limits)
  { kind: "override_rules", re: /\b(invente|inventa|crie|cria|forje)\b.{0,30}\b(versiculo|citacao|autor|fonte|referencia)\b/ },
  { kind: "override_rules", re: /\bsem citar (fontes?|referencias?)\b/ },
  { kind: "override_rules", re: /\b(ordem|mensagem|comando) do (sistema|desenvolvedor|administrador)\b/ },
  { kind: "override_rules", re: /\bignore (o )?limite de\b/ },
  // secrets
  { kind: "secrets", re: /\b(chave de api|api key|variaveis? de ambiente|senha do banco|token de acesso|service role|segredos? do (app|sistema))\b/ },
];

const REPLIES: Record<InjectionKind, string> = {
  reveal_prompt: "{n}, as minhas instruções internas ficam comigo, mas o que importa eu faço questão de mostrar: toda resposta vem com a fonte, a Bíblia ou uma obra do acervo. Vamos voltar ao estudo? Qual texto ou tema você quer ver agora?",
  change_role: "{n}, eu sou o Professor Filipe, uma inteligência artificial de estudo bíblico, e é nesse papel que posso te ajudar de verdade. Não sou humano nem pastor. Quer escolher uma passagem ou um tema para a gente estudar agora?",
  override_rules: "{n}, eu só afirmo o que está na Bíblia e nas obras do acervo, sempre com a fonte, então não invento versículo nem citação. Posso te mostrar o que o texto realmente diz. Sobre qual passagem você quer conversar?",
  secrets: "{n}, não tenho acesso a chaves nem a configurações do sistema, e não as compartilho. Posso te ajudar com o estudo da Bíblia. Qual passagem ou tema você quer explorar?",
};

export function screenInput(text: string): InjectionKind | null {
  const t = norm(text);
  for (const r of RULES) if (r.re.test(t)) return r.kind;
  return null;
}

/** Fixed, valid reply for a blocked attempt. */
export function injectionResponse(kind: InjectionKind, name: string): TeacherResponse {
  const speech = REPLIES[kind].replace("{n}", name);
  return {
    speech,
    display_markdown: "",
    citations: [],
    visuals: [],
    next_options: [
      { label: "Escolher um tema", intent: "ask" },
      { label: "Encerrar por agora", intent: "stop" },
    ],
    lens_divergence: { present: false, summary: null },
    pastoral_flag: false,
    level_signal: "same",
    mode_payload: null,
  };
}

/** Word 6-grams of the internal identity text; an answer sharing any of them is copying the instructions. */
const grams = (s: string, n = 6) => {
  const w = norm(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
};
const SECRET_GRAMS = grams(LAYER_IDENTITY);
// The identity text tells the teacher to SAY some sentences ("Não encontrei isso nas minhas fontes", "Entendes o que lês?"): saying them is not a leak. Their grams are allowed.
for (const q of LAYER_IDENTITY.matchAll(/["“]([^"”]{12,120})["”]/g)) for (const g of grams(q[1])) SECRET_GRAMS.delete(g);

export function leaksPrompt(answer: string): boolean {
  for (const g of grams(answer)) if (SECRET_GRAMS.has(g)) return true;
  return false;
}
