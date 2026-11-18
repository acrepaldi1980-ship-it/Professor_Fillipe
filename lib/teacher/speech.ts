// Spoken-turn rules enforced in code (RA-06): every turn ends with a question or a choice.
export function endsWithQuestion(speech: string): boolean {
  const t = speech.trim();
  return /\?\s*["”')]*\s*$/.test(t) || /\b(ou|prefere|quer)\b[^.?!]{0,120}\?/.test(t.slice(-200));
}

export const FOLLOW_UP = "Posso te ajudar com algum assunto da Bíblia?";

/** Adds a closing question when the model forgot one (typically short refusals). */
export function ensureClosingQuestion(speech: string): string {
  return endsWithQuestion(speech) ? speech : `${speech.trim()} ${FOLLOW_UP}`;
}
