import type { AudioPlayer } from "../types";

export class WebAudioPlayer implements AudioPlayer {
  private el: HTMLAudioElement | null = null;
  private rate = 1;
  private levelListeners = new Set<(level: number) => void>();
  private raf = 0;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private wired = new WeakSet<HTMLAudioElement>();
  /** Recent loudest peak (decays over ~1 s): the mouth opens relative to it, so any voice (loud or quiet) moves the same way. */
  private ref = 0.25;

  async play(source: Blob | ArrayBuffer | string) {
    this.stop();
    const url =
      typeof source === "string"
        ? source
        : URL.createObjectURL(source instanceof Blob ? source : new Blob([source]));
    const el = new Audio(url);
    el.playbackRate = this.rate;
    this.el = el;
    this.ref = 0.25;
    this.attachAnalyser(el);
    // a suspended AudioContext (autoplay rules) would route the audio into silence: wake it before playing
    if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => undefined);
    await new Promise<void>((resolve, reject) => {
      el.onended = () => resolve();
      el.onerror = () => reject(new Error("audio_playback_failed"));
      el.onpause = () => resolve();
      el.play().catch(reject);
    });
    cancelAnimationFrame(this.raf);
    this.levelListeners.forEach((cb) => cb(0));
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }

  stop() {
    if (this.el) {
      this.el.pause();
      this.el = null;
    }
    cancelAnimationFrame(this.raf);
    this.levelListeners.forEach((cb) => cb(0));
  }

  isPlaying() {
    return !!this.el && !this.el.paused;
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.el) this.el.playbackRate = rate;
  }

  onLevel(cb: (level: number) => void) {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }

  private attachAnalyser(el: HTMLAudioElement) {
    if (this.wired.has(el)) return;
    this.wired.add(el);
    this.ctx ??= new AudioContext();
    const src = this.ctx.createMediaElementSource(el);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512; // ~11 ms window: the mouth follows the real audio without lag
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    const buf = new Uint8Array(this.analyser.fftSize);
    const tick = () => {
      this.analyser!.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      this.ref = Math.max(0.12, this.ref * 0.985, peak);
      // scaled to the range the avatar expects from every voice (the jaw multiplies it by ~3.4)
      const level = peak < 0.03 ? 0 : Math.min(1, peak / this.ref) * 0.3;
      this.levelListeners.forEach((cb) => cb(level));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
}
