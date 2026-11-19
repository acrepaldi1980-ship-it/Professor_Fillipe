import type { Speech } from "../types";

// On-device text-to-speech (Web Speech API): free, works offline, and on current phones/browsers it has natural
// pt-BR voices (iOS "Luciana", Android/Chrome "Google português do Brasil", Edge "Online (Natural)").
// Quality depends on the device, so we always pick the best installed pt-BR voice.
const GOOD = /natural|online|premium|enhanced|neural|luciana|francisca|antonio|felipe|google/i;

function score(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/pt[-_]BR/i.test(v.lang)) s += 100;
  else if (/^pt/i.test(v.lang)) s += 40;
  else return -1;
  if (GOOD.test(v.name)) s += 30;
  if (/natural|online|neural/i.test(v.name)) s += 20;
  if (/premium|enhanced/i.test(v.name)) s += 15;
  if (v.localService) s += 2;
  return s;
}

export class WebSpeech implements Speech {
  private voice: SpeechSynthesisVoice | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  unlock() {
    if (!this.isSupported()) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  private async pickVoice(): Promise<SpeechSynthesisVoice | null> {
    if (this.voice) return this.voice;
    const synth = window.speechSynthesis;
    if (!synth.getVoices().length) {
      await new Promise<void>((res) => {
        const done = () => res();
        synth.addEventListener("voiceschanged", done, { once: true });
        setTimeout(done, 1200);
      });
    }
    const best = synth
      .getVoices()
      .map((v) => ({ v, s: score(v) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)[0];
    this.voice = best?.v ?? null;
    return this.voice;
  }

  async speak(text: string, opts: { rate?: number; onLevel?: (level: number) => void } = {}): Promise<void> {
    if (!this.isSupported()) return;
    const voice = await this.pickVoice();
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang ?? "pt-BR";
      if (voice) u.voice = voice;
      u.rate = opts.rate ?? 1;
      // The Web Speech API exposes no audio, so the mouth follows word boundaries plus a speech-like flutter.
      let pulse = 0;
      let t = 0;
      const stop = () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        opts.onLevel?.(0);
        resolve();
      };
      u.onboundary = () => (pulse = 0.55);
      u.onend = stop;
      u.onerror = stop;
      u.onstart = () => {
        this.timer = setInterval(() => {
          t += 0.06;
          pulse *= 0.82;
          const flutter = 0.12 + 0.1 * Math.abs(Math.sin(t * 13)) + 0.06 * Math.abs(Math.sin(t * 5.3));
          opts.onLevel?.(Math.min(0.5, flutter + pulse * 0.5));
        }, 60);
      };
      window.speechSynthesis.speak(u);
    });
  }

  cancel() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
