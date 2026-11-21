// Fake implementations of every platform interface, for unit tests (spec 10.6.2).
import type { Platform } from "./types";

export function createMockPlatform(overrides: Partial<Platform> = {}): Platform & { calls: string[] } {
  const calls: string[] = [];
  const mem = new Map<string, unknown>();
  const p: Platform = {
    name: "web",
    microphone: { isSupported: () => true, start: async () => void calls.push("mic.start"), stop: async () => new Blob(["x"]), onLevel: () => () => {} },
    audioPlayer: { play: async () => void calls.push("audio.play"), stop: () => void calls.push("audio.stop"), isPlaying: () => false, setRate: () => {}, onLevel: () => () => {} },
    speech: { isSupported: () => true, unlock: () => {}, speak: async (t) => void calls.push(`speech.speak:${t}`), cancel: () => void calls.push("speech.cancel"), voices: async () => [{ name: "Mock", lang: "pt-BR" }], hasMaleVoice: async () => true },
    push: { isSupported: () => true, requestPermission: async () => "granted", getToken: async () => "mock-token" },
    store: {
      get: async <T,>(k: string) => (mem.has(k) ? (mem.get(k) as T) : null),
      set: async (k, v) => void mem.set(k, v),
      remove: async (k) => void mem.delete(k),
    },
    share: { canShare: () => true, share: async () => "shared" },
    files: { save: async (name) => void calls.push(`files.save:${name}`) },
    deepLinks: { onOpen: () => () => {}, currentUrl: () => "https://app.test/" },
    purchases: { openCheckout: async (url) => void calls.push(`purchases.openCheckout:${url}`) },
    haptics: { impact: () => void calls.push("haptics.impact") },
    statusBar: { setStyle: () => void calls.push("statusBar.setStyle") },
    ...overrides,
  };
  return Object.assign(p, { calls });
}
