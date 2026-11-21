import es from "./es.json";
import ptBR from "./pt-BR.json";

export type MessageKey = keyof typeof ptBR;
export type Lang = "pt-BR" | "es";
export const LANGS: Lang[] = ["pt-BR", "es"];

const DICTS: Record<Lang, Record<string, string>> = { "pt-BR": ptBR, es };
let current: Lang = "pt-BR";

export const isLang = (v: unknown): v is Lang => v === "pt-BR" || v === "es";
export const getLanguage = (): Lang => current;
export function setLanguage(lang: Lang) {
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = lang === "es" ? "es" : "pt-BR";
}

/** The Bible version the app shows by default in the current language (the student's own choice in Conta still wins where it is used). */
export const defaultBibleVersion = () => (current === "es" ? "spa_rv_1909" : "por_blivre_2018");

/** All UI strings go through here (RNF-10). A key missing in the current language falls back to Portuguese, so a screen is never blank. */
export function t(key: MessageKey): string {
  return DICTS[current][key] ?? ptBR[key];
}
