// "Mude a introdução", "refaça o ponto 2", "deixe as perguntas mais simples": a change request said in the conversation, after the
// document was delivered. Returns which section to rewrite and the instruction; null when the message is not a change request.
export interface EditIntent { section: string; instruction: string; label: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VERB = /\b(mude|muda|mudar|troque|troca|trocar|refaca|refazer|reescreva|reescrever|ajuste|ajusta|ajustar|melhore|melhora|melhorar|inclua|incluir|adicione|adicionar|acrescente|acrescentar|tire|tirar|remova|simplifique|simplificar|deixe|deixa|substitua|substituir|altere|alterar|corrija|corrigir|aprofunde|encurte|resuma|amplie|ampliar|use outro|usar outro|mais curto|mais curta|mais simples|mais longo|mais longa)\b/;

export function detectEdit(text: string, mode: string, divisionCount = 0): EditIntent | null {
  const t = norm(text);
  if (!VERB.test(t)) return null;
  const pick = (section: string, label: string): EditIntent => ({ section, label, instruction: text.trim().slice(0, 400) });
  if (mode === "lesson") {
    if (/\b(objetivo|objetivos)\b/.test(t)) return pick("objective", "o objetivo");
    if (/quebra.?gelo/.test(t)) return pick("icebreaker", "o quebra-gelo");
    if (/\bcontexto\b/.test(t)) return pick("context", "o contexto");
    if (/\b(pontos?|desenvolvimento|topicos?)\b/.test(t)) return pick("points", "os pontos principais");
    if (/\bdinamica\b/.test(t)) return pick("dynamic", "a dinâmica");
    if (/\bperguntas?\b/.test(t)) return pick("questions", "as perguntas");
    if (/\baplicacao\b/.test(t)) return pick("application", "a aplicação");
    if (/\bversiculo\b/.test(t)) return pick("memory_verse", "o versículo para memorizar");
  }
  if (mode === "sermon") {
    if (/ideia central/.test(t)) return pick("central_idea", "a ideia central");
    if (/\bintroducao\b/.test(t)) return pick("introduction", "a introdução");
    const d = /\b(?:divisao|ponto|parte)\s*(?:numero\s*)?(\d)\b/.exec(t) ?? /\b(primeira|segunda|terceira|quarta)\s+(?:divisao|ponto|parte)\b/.exec(t);
    if (d) {
      const n = /^\d$/.test(d[1]) ? Number(d[1]) : ({ primeira: 1, segunda: 2, terceira: 3, quarta: 4 } as Record<string, number>)[d[1]];
      if (n >= 1 && n <= Math.max(divisionCount, 1)) return pick(`division_replace:${n - 1}`, `a divisão ${n}`);
    }
    if (/\bconclusao\b/.test(t)) return pick("conclusion", "a conclusão");
    if (/\bapelo\b/.test(t)) return pick("appeal", "o apelo");
  }
  if (mode === "deep") {
    if (/\bresumo\b/.test(t)) return pick("overview", "o resumo");
    if (/\bcontexto\b/.test(t)) return pick("context", "o contexto");
    if (/\bestrutura\b/.test(t)) return pick("structure", "a estrutura");
    if (/\b(palavras?|original|grego|hebraico|strong)\b/.test(t)) return pick("keywords", "as palavras do original");
    if (/\b(tradicao|tradicoes|visoes|visao|catolic\w*|reformad\w*|pentecostal\w*|ortodox\w*|batista\w*)\b/.test(t)) return pick("traditions", "as visões das tradições");
    if (/\baplicacao\b/.test(t)) return pick("application", "a aplicação");
  }
  return null;
}

/** Puts the note before the closing question, so the answer still ends with a question to the student (RA-06). */
export function appendNote(speech: string, note: string): string {
  const s = speech.trim();
  const cut = Math.max(s.lastIndexOf(". ", s.length - 2), s.lastIndexOf("! ", s.length - 2));
  if (s.endsWith("?") && cut > 0) return `${s.slice(0, cut + 1)} ${note.trim()} ${s.slice(cut + 2)}`;
  return `${s} ${note.trim()}${s.endsWith("?") ? "" : " O que mais você quer ajustar?"}`;
}
