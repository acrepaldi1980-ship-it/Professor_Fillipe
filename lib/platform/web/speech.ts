import { prepareForSpeech } from "@/lib/voice/speech-text";
import { SpeechClock } from "@/lib/voice/clock";
import { levelAt, planText, wordAt } from "@/lib/voice/visemes";

// Measured pace of each voice (real ms per planned ms), kept in memory and in the device storage.
const SPEED_CAL = new Map<string, number>();
const CAL_KEY = "pf.speechcal.v1";
function loadCal(key: string): number | undefined {
  try {
    const v = (JSON.parse(localStorage.getItem(CAL_KEY) ?? "{}") as Record<string, number>)[key];
    return typeof v === "number" && v > 0.5 && v < 2.2 ? v : undefined;
  } catch {
    return undefined;
  }
}
function saveCal(key: string, v: number) {
  try {
    const all = JSON.parse(localStorage.getItem(CAL_KEY) ?? "{}") as Record<string, number>;
    all[key] = Math.round(v * 1000) / 1000;
    localStorage.setItem(CAL_KEY, JSON.stringify(all));
  } catch {
    /* no storage: the calibration just lives in memory */
  }
}
import type { Speech, SpeechOptions } from "../types";

// On-device text-to-speech (Web Speech API): free, works offline, and on current phones/browsers it has natural
// pt-BR voices (iOS "Luciana", Android/Chrome "Google português do Brasil", Edge "Online (Natural)").
// Quality depends on the device, so we always pick the best installed pt-BR voice.
const GOOD = /natural|online|premium|enhanced|neural/i;
// Names of male and female Portuguese voices found on current systems (Windows/Edge, iOS, Android, Chrome).
const MALE = /antonio|ant[oô]nio|felipe|ricardo|daniel|thiago|jorge|luiz|fabio|donato|diego|juan|carlos|pablo|enrique|raul|ra[uú]l|alvaro|[aá]lvaro|pedro|miguel|andr[eé]s|alonso|\bjavier\b|\bmale\b|masculin|\bmasc\b|[-_]ptd[-_]|\bptd\b/i;
const FEMALE = /francisca|luciana|fernanda|maria|vitoria|vit[oó]ria|camila|helena|giovanna|brenda|leila|monica|m[oó]nica|paulina|laura|sabina|elvira|dalia|lucia|luc[ií]a|marisol|elena|valentina|\bfemale\b|feminin|[-_]afs[-_]|\bafs\b/i;

/** The teacher is a man: every spoken line must come from a male voice (owner's rule, 21/11/2026). Names and ids that tell the gender are matched. */
export const isMaleVoice = (v: { name: string; voiceURI?: string }) => {
  const id = `${v.name} ${v.voiceURI ?? ""}`;
  return MALE.test(id) && !FEMALE.test(id);
};

function score(v: SpeechSynthesisVoice, lang: "pt" | "es" = "pt"): number {
  let s = 0;
  if (lang === "es") { if (/es[-_](MX|US|419|AR|CO)/i.test(v.lang)) s += 100; else if (/^es/i.test(v.lang)) s += 80; else return -1; }
  else if (/pt[-_]BR/i.test(v.lang)) s += 100;
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
  private lang: "pt" | "es" = "pt";

  /** Language of the teacher's voice on this device (the student's interface language). */
  setLanguage(lang: "pt" | "es") {
    if (lang === this.lang) return;
    this.lang = lang; this.list = null; this.voice = null;
  }

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
    this.list = synth.getVoices().map((v) => ({ v, s: score(v, this.lang) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.v);
    return this.list;
  }

  async voices() {
    if (!this.isSupported()) return [];
    return (await this.maleList()).map((v) => ({ name: v.name, lang: v.lang }));
  }

  /** Male Portuguese voices installed on the device, best first. */
  private async maleList(): Promise<SpeechSynthesisVoice[]> {
    return (await this.loadVoices()).filter(isMaleVoice);
  }

  async hasMaleVoice(): Promise<boolean> {
    return this.isSupported() && (await this.maleList()).length > 0;
  }

  private async pickVoice(name?: string | null): Promise<SpeechSynthesisVoice | null> {
    const males = await this.maleList();
    if (name) return males.find((v) => v.name === name) ?? males[0] ?? null;
    this.voice ??= males[0] ?? null;
    return this.voice;
  }

  async speak(raw: string, opts: SpeechOptions = {}): Promise<void> {
    if (!this.isSupported()) return;
    // "Lucas 15:11-32" must be spoken as "Lucas, capítulo 15, versículos 11 a 32" (not read as a clock time), and names get their pronunciation.
    const text = prepareForSpeech(raw);
    const voice = await this.pickVoice(opts.voiceName);
    // No male voice on this device: never speak with a female voice. The caller shows the text and explains how to get a male voice.
    if (!voice) {
      opts.onUnavailable?.();
      return;
    }
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang ?? (this.lang === "es" ? "es-MX" : "pt-BR");
      if (voice) u.voice = voice;
      // Calm, slightly lower voice: a mature teacher, not an announcer.
      u.rate = opts.rate ?? 0.93;
      u.pitch = opts.pitch ?? 0.92;
      // The Web Speech API exposes no audio, so the mouth is planned from the text (syllables and pauses). The plan is played on a
      // clock that follows the REAL speed of the voice: every word boundary reported by the engine re-anchors the clock and refines
      // the speed (moving average), and the speed measured at the end of each utterance is remembered per voice, so devices that
      // report no boundaries still start close to the right pace.
      const plan = planText(text, u.rate);
      const calKey = `${voice?.name ?? "default"}@${u.rate}`;
      const clock = new SpeechClock(SPEED_CAL.get(calKey) ?? loadCal(calKey) ?? 1);
      let t0 = 0;
      let raf = 0;
      const stop = () => {
        cancelAnimationFrame(raf);
        this.timer = null;
        opts.onLevel?.(0);
        if (plan.length && t0) {
          // remember the pace of this voice for the next sentences (only a clean measurement: it ended and had boundaries or enough text)
          const planned = plan[plan.length - 1].endMs;
          const measured = (performance.now() - t0) / planned;
          if (planned > 600 && measured > 0.5 && measured < 2.2) {
            const prev = SPEED_CAL.get(calKey) ?? clock.speed;
            const next = clock.boundaries > 0 ? 0.5 * prev + 0.5 * clock.speed : 0.6 * prev + 0.4 * measured;
            SPEED_CAL.set(calKey, next);
            saveCal(calKey, next);
          }
        }
        resolve();
      };
      u.onboundary = (e) => {
        if (!plan.length) return;
        const w = plan[wordAt(plan, e.charIndex)];
        clock.boundary(w.startMs, performance.now());
      };
      u.onend = stop;
      u.onerror = stop;
      u.onstart = () => {
        t0 = performance.now();
        clock.start(t0);
        const loop = () => {
          opts.onLevel?.(levelAt(plan, clock.planNow(performance.now())));
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      };
      window.speechSynthesis.speak(u);
    });
  }

  cancel() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    this.timer = null;
  }
}
