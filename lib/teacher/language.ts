// Language guard: the teacher always speaks the student's language (Brazilian Portuguese, or Spanish). A free model sometimes drifts into Italian, English or Latin
// when the retrieved passages are in another language. Cheap stopword count, no model call. Quotes of one or two words never trip it.
const LISTS: Record<string, string> = {
  pt: "o a os as de do da dos das em no na nos nas um uma uns umas que não é são foi com para por mais como mas seu sua seus suas ele ela eles elas você já também isso este esta esse essa ao aos pelo pela quando onde porque",
  es: "el la los las de del en un una unos unas que no es son fue con para por más como pero su sus él ella ellos ellas usted ya también eso este esta ese esa al cuando donde porque",
  en: "the of and to in is are was were with for by that this these those as but his her their he she they it you not be been which from at on or an have has had its who",
  it: "il lo la i gli le di del della dei degli delle in un una che non è sono fu con per più come ma suo sua suoi loro egli ella essi anche questo questa nel nella nei alla alle sul sulla perché quando dove si",
  fr: "le la les de du des en un une que ne est sont fut avec pour par plus comme mais son sa ses il elle ils elles vous aussi ce cette dans au aux sur quand où parce",
  de: "der die das und ist sind war mit für von nicht ein eine zu auf den dem des im als auch sich er sie es wir ihr aber wenn",
  la: "et est in non ad cum ex quod sed qui quae quia sunt esse ab de per ut si hoc",
};
const SETS = Object.fromEntries(Object.entries(LISTS).map(([k, v]) => [k, new Set(v.split(" "))]));

export function languageScores(text: string): Record<string, number> {
  const words = text.toLowerCase().normalize("NFC").split(/[^\p{L}]+/u).filter(Boolean);
  const out: Record<string, number> = {};
  for (const [k, set] of Object.entries(SETS)) out[k] = words.filter((w) => set.has(w)).length;
  return out;
}

/** True when the text is clearly NOT in the wanted language (pt or es): another language scores much higher, with enough words to be sure. */
export function wrongLanguage(text: string, want: "pt" | "es" = "pt"): string | null {
  const s = languageScores(text);
  const mine = s[want];
  // Portuguese and Spanish (and Italian) share many words: compare against the best OTHER language with a margin.
  const [other, v] = Object.entries(s).filter(([k]) => k !== want).sort((a, b) => b[1] - a[1])[0];
  if (v >= 6 && v > mine * 1.3) return other;
  return null;
}

/** A retrieved passage written mostly in Italian, French, German or Latin (the library is Portuguese, English and Spanish): not usable as a source to speak from. */
export function foreignChunk(text: string): boolean {
  const s = languageScores(text);
  const home = Math.max(s.pt, s.en, s.es);
  const [, v] = Object.entries(s).filter(([k]) => ["it", "fr", "de", "la"].includes(k)).sort((a, b) => b[1] - a[1])[0];
  return v >= 8 && v > home * 1.2;
}
