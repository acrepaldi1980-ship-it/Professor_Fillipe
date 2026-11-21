import type { Microphone } from "../types";

export class WebMicrophone implements Microphone {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private levelListeners = new Set<(level: number) => void>();
  private ctx: AudioContext | null = null;
  private raf = 0;

  isSupported() {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(opts: { bitsPerSecond?: number } = {}) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, opts.bitsPerSecond ? { audioBitsPerSecond: opts.bitsPerSecond } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start();
    this.ctx = new AudioContext();
    const analyser = this.ctx.createAnalyser();
    this.ctx.createMediaStreamSource(this.stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      this.levelListeners.forEach((cb) => cb(peak));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      cancelAnimationFrame(this.raf);
      const recorder = this.recorder;
      if (!recorder) return resolve(new Blob());
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        this.stream?.getTracks().forEach((t) => t.stop());
        this.ctx?.close();
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.stop();
    });
  }

  onLevel(cb: (level: number) => void) {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }
}
