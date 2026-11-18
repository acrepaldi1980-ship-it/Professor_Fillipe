// Appearance preferences (theme and text size, RNF-05), kept through lib/platform and applied to <html>.
import { getPlatform } from "@/lib/platform";

export type Theme = "auto" | "light" | "dark";
export interface Prefs {
  theme: Theme;
  fontScale: number; // 1 to 2
}
const KEY = "prefs.v1";
export const DEFAULT_PREFS: Prefs = { theme: "auto", fontScale: 1 };

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  if (p.theme === "auto") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", p.theme);
  el.style.setProperty("--font-scale", String(Math.min(2, Math.max(1, p.fontScale))));
}

export async function loadPrefs(): Promise<Prefs> {
  return { ...DEFAULT_PREFS, ...((await getPlatform().store.get<Prefs>(KEY)) ?? {}) };
}

export async function savePrefs(p: Prefs): Promise<void> {
  await getPlatform().store.set(KEY, p);
  applyPrefs(p);
}
