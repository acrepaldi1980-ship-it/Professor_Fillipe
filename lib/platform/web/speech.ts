import type { Speech, SpeechOptions } from "../types";

// On-device text-to-speech (Web Speech API): free, works offline, and on current phones/browsers it has natural
// pt-BR voices (iOS "Luciana", Android/Chrome "Google português do Brasil", Edge "Online (Natural)").
// Quality depends on the device, so we always pick the best installed pt-BR voice.
const GOOD = /natural|online|premium|enhanced|neural/i;
// Names of male and female Portuguese voices found on current systems (Windows/Edge, iOS, Android, Chrome).
const MALE = /antonio|ant[oô]nio|felipe|ricardo|daniel|thiago|jorge|luiz|fabio|donato|male|masculin|\bmasc\b/i;
const FEMALE = /francisca|luciana|maria|vitoria|vit[oó]ria|camila|helena|giovanna|female|feminin|google portugu/i;

function score(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/pt[-_]BR/i.test(v.lang)) s += 100;
  else if (/^pt/i.test(v.lang)) s += 40;
  else return -1;
  if (MALE.test(v.name)) s += 60; // the teacher is a mature man: a male voice fits the character
  if (FEMALE.test(v.name)) s -= 30;
  if (GOOD.test(v.name)) s += 25;
  if (v.localService) s += 2;
  return s;
}

export class WebSpeech implements Speech {
  private voice: SpeechSynthesisVoice | null = null;
  private list: SpeechSynthesisVoice[] | null = null;
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

  private async loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (this.list?.length) return this.list;
    const synth = window.speechSynthesis;
    if (!synth.getVoices().length) {
      await new Promise<void>((res) => {
        synth.addEventListener("voiceschanged", () => res(), { once: true });
        setTimeout(res, 1200);
      });
    }
    this.list = synth.getVoices().map((v) => ({ v, s: score(v) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.v);
    return this.list;
  }

  async voices() {
    if (!this.isSupported()) return [];
    return (await this.loadVoices()).map((v) => ({ name: v.name, lang: v.lang }));
  }

  private async pickVoice(name?: string | null): Promise<SpeechSynthesisVoice | null> {
    const all = await this.loadVoices();
    if (name) return all.find((v) => v.name === name) ?? all[0] ?? null;
    this.voice ??= all[0] ?? null;
    return this.voice;
  }

  async speak(text: string, opts: SpeechOptions = {}): Promise<void> {
    if (!this.isSupported()) return;
    const voice = await this.pickVoice(opts.voiceName);
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang ?? "pt-BR";
      if (voice) u.voice = voice;
      // Calm, slightly lower voice: a mature teacher, not an announcer.
      u.rate = opts.rate ?? 0.93;
      u.pitch = opts.pitch ?? (voice && MALE.test(voice.name) ? 0.92 : 0.8);
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
