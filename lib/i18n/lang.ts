// The student's interface language (Prompt 2.7): kept through lib/platform and mirrored on the profile (profiles.locale) for the server.
import { getPlatform } from "@/lib/platform";
import { isLang, LANG_INFO, setLanguage, type Lang } from "./index";

const KEY = "pf-lang";

export async function loadLanguage(): Promise<Lang> {
  const v = await getPlatform().store.get<string>(KEY);
  return isLang(v) ? v : "pt-BR";
}
export async function saveLanguage(lang: Lang): Promise<void> {
  await getPlatform().store.set(KEY, lang);
}
/** Applies the language to the interface strings and to the device voice. */
export function applyLanguage(lang: Lang) {
  setLanguage(lang);
  getPlatform().speech.setLanguage?.(LANG_INFO[lang].short);
}
