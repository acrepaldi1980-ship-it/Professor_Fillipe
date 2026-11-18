import type { AudioPlayer } from "../types";

export class WebAudioPlayer implements AudioPlayer {
  private el: HTMLAudioElement | null = null;
  private rate = 1;
  private levelListeners = new Set<(level: number) => void>();
  private raf = 0;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private wired = new WeakSet<HTMLAudioElement>();

  async play(source: Blob | ArrayBuffer | string) {
    this.stop();
    const url =
      typeof source === "string"
        ? source
        : URL.createObjectURL(source instanceof Blob ? source : new Blob([source]));
    const el = new Audio(url);
    el.playbackRate = this.rate;
    this.el = el;
    this.attachAnalyser(el);
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
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    const buf = new Uint8Array(this.analyser.fftSize);
    const tick = () => {
      this.analyser!.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      this.levelListeners.forEach((cb) => cb(peak));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
}
