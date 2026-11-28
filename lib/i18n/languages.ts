// The four languages of the app (decision D-29, 28/11/2026): Brazilian Portuguese, English, Spanish and Italian. One table for everything that depends on the language,
// shared by the screens, the teacher's prompt, the voice and the Bible defaults (no `=== "es"` scattered around the code).
export type Lang = "pt-BR" | "en" | "es" | "it";
export const LANGS: Lang[] = ["pt-BR", "en", "es", "it"];

export interface LangInfo {
  /** Two-letter code used by speech recognition and detection ("pt", "en", "es", "it"). */
  short: "pt" | "en" | "es" | "it";
  /** BCP 47 tag for the device voice. */
  speech: string;
  /** The language's name in itself (the language picker). */
  ownName: string;
  /** The language's name as the prompts (written in Portuguese) call it. */
  promptName: string;
  /** The Bible version a new student of this language starts with. */
  defaultVersion: string;
  /** How the teacher is called in this language. */
  teacherName: string;
}

export const LANG_INFO: Record<Lang, LangInfo> = {
  "pt-BR": { short: "pt", speech: "pt-BR", ownName: "Português (Brasil)", promptName: "português do Brasil", defaultVersion: "por_blivre_2018", teacherName: "Professor Filipe" },
  en: { short: "en", speech: "en-US", ownName: "English", promptName: "inglês", defaultVersion: "eng_web", teacherName: "Professor Filipe" },
  es: { short: "es", speech: "es-MX", ownName: "Español", promptName: "espanhol latino-americano neutro", defaultVersion: "spa_rv_1909", teacherName: "Profesor Filipe" },
  it: { short: "it", speech: "it-IT", ownName: "Italiano", promptName: "italiano", defaultVersion: "ita_diodati_1885", teacherName: "Professor Filipe" },
};

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as string[]).includes(v);
/** Anything stored or sent (a profile's locale, a request field) to a language of the app; Portuguese when it is not one. */
export const toLang = (v: unknown): Lang => (isLang(v) ? v : "pt-BR");
