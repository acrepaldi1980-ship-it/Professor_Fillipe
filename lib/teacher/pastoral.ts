// Pastoral-crisis handling (spec 8.5.8, RA-17). The standard reply text is meant to be reviewed by the
// theological council before launch. Phase 0 uses a conservative keyword screen; Prompt 1.5 adds a model classifier.
import type { TeacherResponse } from "./schema";

const CRISIS_PATTERNS: RegExp[] = [
  /\b(me matar|quero morrer|vou me matar|tirar minha vida|acabar com a minha vida|suic[ií]d)/i,
  /\b(automutila|me cortar|me machucar|n[aã]o quero mais viver|n[aã]o aguento mais viver)/i,
  /\b(depress[aã]o|depressivo|crise de ansiedade|desespero)\b/i,
  /\b(luto|perdi (meu|minha) (pai|m[aã]e|filho|filha|esposa|marido|irm[aã]o|irm[aã]))\b/i,
  // someone close to the student died (not a study question like "Jesus morreu na cruz")
  /\b(meu|minha) (pai|m[aã]e|filho|filha|esposa|marido|irm[aã]o|irm[aã]|av[oô]|av[oó]|amigo|amiga|noivo|noiva)\b[^.?!]{0,40}\b(morreu|faleceu|partiu|se foi|foi embora de vez)\b/i,
  /\b(morreu|faleceu)\b[^.?!]{0,20}\b(meu|minha) (pai|m[aã]e|filho|filha|esposa|marido|irm[aã]o|irm[aã]|av[oô]|av[oó])\b/i,
  /\b(n[aã]o consigo parar de chorar|s[oó] choro|choro (todos os dias|o dia todo)|n[aã]o tenho for[cç]as para nada)\b/i,
  /\b(vontade de viver|sentido (em|na) (viver|vida)|n[aã]o consigo mais viver|n[aã]o quero (mais )?(estar aqui|existir)|queria (sumir|desaparecer|n[aã]o existir))/i,
  /\b(tomei|engoli) (todos|tudo|muitos|v[aá]rios)\b[^.?!]{0,30}\b(rem[eé]dios?|comprimidos?|p[ií]lulas?|medicamentos?)/i,
  /\b(abusad[oa]|violentad[oa]|molestad[oa])\b|\b(me|nos) (amea[cç]a|agride|espanca)\b|amea[cç]a de morte|viol[eê]ncia (em|dentro de) casa|sofrendo viol[eê]ncia/i,
  /\b(fui (abusad|estuprad|agredid)|apanho|me bate|viol[eê]ncia dom[eé]stica|abuso sexual)\b/i,
];

export function detectPastoralCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

/** Standard reply (to be reviewed by the council). Kept short, warm, and without counseling. */
export function pastoralResponse(name: string): TeacherResponse {
  return {
    speech: `${name}, sinto muito que você esteja passando por isso. Eu sou uma inteligência artificial de estudo bíblico e não consigo cuidar de você como uma pessoa pode. Procure agora alguém de confiança: seu pastor ou líder, um profissional de saúde, ou ligue para o CVV no 188, que atende de graça, a qualquer hora. Se houver risco imediato, ligue para o SAMU no 192. Quando você se sentir pronto, podemos voltar ao estudo. Quer continuar conversando?`,
    display_markdown:
      "**Você não está só.** Procure ajuda agora:\n\n- **CVV: 188** (gratuito, 24 horas)\n- **SAMU: 192** (risco imediato)\n- Seu pastor, líder ou alguém de confiança\n- Um profissional de saúde\n\nQuando quiser, podemos voltar ao estudo.",
    citations: [],
    visuals: [],
    next_options: [
      { label: "Quero continuar o estudo", intent: "next" },
      { label: "Prefiro parar por agora", intent: "stop" },
    ],
    lens_divergence: { present: false, summary: null },
    pastoral_flag: true,
    level_signal: "same",
    avatar_cue: "empathetic",
    mode_payload: null,
  };
}
