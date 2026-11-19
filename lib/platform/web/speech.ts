import { prepareForSpeech } from "@/lib/voice/speech-text";
import { levelAt, planText, wordAt } from "@/lib/voice/visemes";
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

  async speak(raw: string, opts: SpeechOptions = {}): Promise<void> {
    if (!this.isSupported()) return;
    // "Lucas 15:11-32" must be spoken as "Lucas, capítulo 15, versículos 11 a 32" (not read as a clock time), and names get their pronunciation.
    const text = prepareForSpeech(raw);
    const voice = await this.pickVoice(opts.voiceName);
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang ?? "pt-BR";
      if (voice) u.voice = voice;
      // Calm, slightly lower voice: a mature teacher, not an announcer.
      u.rate = opts.rate ?? 0.93;
      u.pitch = opts.pitch ?? (voice && MALE.test(voice.name) ? 0.92 : 0.8);
      // The Web Speech API exposes no audio, so the mouth is planned from the text (syllables and pauses) and re-aligned
      // to the engine every time it reports a word boundary.
      const plan = planText(text, u.rate);
      let t0 = 0;
      let shift = 0; // ms: how far the engine is ahead (+) or behind (-) our estimate
      const stop = () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        opts.onLevel?.(0);
        resolve();
      };
      u.onboundary = (e) => {
        if (!plan.length) return;
        const w = plan[wordAt(plan, e.charIndex)];
        shift = w.startMs - (performance.now() - t0);
      };
      u.onend = stop;
      u.onerror = stop;
      u.onstart = () => {
        t0 = performance.now();
        shift = 0;
        this.timer = setInterval(() => {
          opts.onLevel?.(levelAt(plan, performance.now() - t0 + shift));
        }, 30);
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
