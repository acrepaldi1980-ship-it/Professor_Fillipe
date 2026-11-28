import en from "./en.json";
import es from "./es.json";
import it from "./it.json";
import ptBR from "./pt-BR.json";
import { LANG_INFO, type Lang } from "./languages";

export { isLang, LANG_INFO, LANGS, toLang, type Lang, type LangInfo } from "./languages";

export type MessageKey = keyof typeof ptBR;

const DICTS: Record<Lang, Record<string, string>> = { "pt-BR": ptBR, en, es, it };
let current: Lang = "pt-BR";

export const getLanguage = (): Lang => current;
export function setLanguage(lang: Lang) {
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = lang === "pt-BR" ? "pt-BR" : LANG_INFO[lang].short;
}

/** The Bible version the app shows by default in the current language (the student's own choice in Conta still wins where it is used). */
export const defaultBibleVersion = () => LANG_INFO[current].defaultVersion;

/** All UI strings go through here (RNF-10). A key missing in the current language falls back to Portuguese, so a screen is never blank. */
export function t(key: MessageKey): string {
  return DICTS[current][key] ?? ptBR[key];
}
