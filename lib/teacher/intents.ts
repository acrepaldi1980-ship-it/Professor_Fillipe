// Fast intent classifier for navigation commands (spec 8.5.2). Free-form questions fall through to "ask";
// the model refines the intent in later phases.
import type { Intent } from "./schema";

const RULES: [Intent, RegExp][] = [
  ["stop", /^(para|pare|chega( por hoje)?|encerrar|vamos parar|por hoje [eé] s[oó])\b/i],
  ["next", /^(pode seguir|segue|seguir|pr[oó]ximo|continua|continue|avan[cç]a|vamos adiante)\b/i],
  ["deepen", /\b(aprofund[ae]|vai mais fundo|explica melhor|mais detalhes?)\b/i],
  ["simplify", /\b(explica mais simples|n[aã]o entendi|mais simples|simplifica|em palavras simples)\b/i],
  ["example", /\b(me d[aá] um exemplo|d[aá] um exemplo|um exemplo pr[aá]tico)\b/i],
  ["show_map", /\b(mostra (isso )?no mapa|ver no mapa|abre o mapa|mapa disso)\b/i],
  ["show_timeline", /\b(linha do tempo)\b/i],
  ["compare_versions", /\b(outras vers[oõ]es|como (as )?outras (b[ií]blias|vers[oõ]es) traduzem|comparar vers[oõ]es)\b/i],
  ["other_traditions", /\b(outras igrejas|outras tradi[cç][oõ]es|o que as outras (linhas|igrejas) pensam)\b/i],
];

export function classifyIntent(text: string): Intent {
  const t = text.trim();
  for (const [intent, re] of RULES) if (re.test(t)) return intent;
  return "ask";
}
