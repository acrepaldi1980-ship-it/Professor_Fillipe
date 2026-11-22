import type { AudioPlayer } from "../types";
import { computeEnvelope, levelAt, type Envelope } from "@/lib/voice/envelope";
import { audiblePlayhead } from "@/lib/voice/playhead";

interface Clip {
  env: Envelope;
  node: AudioBufferSourceNode;
  /** Start and end on the audio clock (seconds). */
  startAt: number;
  endAt: number;
  started: boolean;
  rate: number;
  onStart?: () => void;
  done: () => void;
}

/**
 * Teacher voice player on the Web Audio clock (RF-M06, RF-M17-02).
 * - Sentences are queued and scheduled back to back on the audio clock: no gaps between them, whatever the network does.
 * - The mouth does not come from an analyser tap (which is ahead of the speakers and jittery): the envelope of each clip is computed from its real samples,
 *   and read at the position that is audible right now (getOutputTimestamp, compensated for the speaker/Bluetooth delay). Silence = closed mouth.
 * - `onStart` fires when the first sound of a clip is really audible, so the text can appear with the voice.
 */
export class WebAudioPlayer implements AudioPlayer {
  private ctx: AudioContext | null = null;
  private clips: Clip[] = [];
  private tail = 0;
  private rate = 1;
  private levelListeners = new Set<(level: number) => void>();
  private raf = 0;
  private gen = 0;
  private lastScheduled: Promise<void> = Promise.resolve();

  private audio(): AudioContext {
    this.ctx ??= new AudioContext();
    return this.ctx;
  }

  async enqueue(source: Blob | ArrayBuffer, hooks: { onStart?: () => void } = {}): Promise<void> {
    const ctx = this.audio();
    const gen = this.gen;
    // Clips are DECODED in parallel but SCHEDULED strictly in the order they were queued: a short sentence that decodes first must not play before the one
    // that was asked first (the sentences of one answer must come out in order).
    const prev = this.lastScheduled;
    let release!: () => void;
    this.lastScheduled = new Promise<void>((r) => { release = r; });
    try {
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      const bytes = source instanceof Blob ? await source.arrayBuffer() : source.slice(0);
      const buffer = await ctx.decodeAudioData(bytes);
      await prev;
      if (gen !== this.gen) return; // stopped while decoding
      const env = computeEnvelope(buffer.getChannelData(0), buffer.sampleRate);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.playbackRate.value = this.rate;
      node.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + 0.04, this.tail);
      const dur = buffer.duration / this.rate;
      this.tail = startAt + dur;
      const played = new Promise<void>((resolve) => {
        const clip: Clip = { env, node, startAt, endAt: startAt + dur, started: false, rate: this.rate, onStart: hooks.onStart, done: resolve };
        node.onended = () => { this.clips = this.clips.filter((c) => c !== clip); clip.done(); if (!this.clips.length) this.idle(); };
        this.clips.push(clip);
        node.start(startAt);
        (globalThis as { __pfSync?: unknown[] }).__pfSync?.push({ t: performance.now(), clip: { startAt, endAt: startAt + dur } }); // test hook: only exists when a test defines it
        this.loop();
      });
      release(); // the next clip may be scheduled now (not when this one has finished playing)
      return played;
    } finally {
      release();
    }
  }

  play(source: Blob | ArrayBuffer | string): Promise<void> {
    this.stop();
    if (typeof source === "string") return fetch(source).then((r) => r.arrayBuffer()).then((b) => this.enqueue(b));
    return this.enqueue(source);
  }

  stop() {
    this.gen++; // clips still decoding must not start
    this.lastScheduled = Promise.resolve();
    const pending = this.clips;
    this.clips = [];
    for (const c of pending) { c.node.onended = null; try { c.node.stop(); } catch { /* not started yet */ } c.done(); }
    this.tail = 0;
    this.idle();
  }

  isPlaying() {
    return this.clips.length > 0;
  }

  setRate(rate: number) {
    this.rate = rate;
  }

  onLevel(cb: (level: number) => void) {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }

  private idle() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.levelListeners.forEach((cb) => cb(0));
  }

  private loop() {
    if (this.raf) return;
    const tick = () => {
      const ctx = this.ctx;
      if (!ctx || !this.clips.length) { this.raf = 0; return; }
      const ph = audiblePlayhead(ctx, performance.now());
      let level = 0;
      for (const c of this.clips) {
        if (ph >= c.startAt && ph <= c.endAt) {
          if (!c.started) { c.started = true; (globalThis as { __pfSync?: unknown[] }).__pfSync?.push({ mark: "onStart", t: performance.now() }); c.onStart?.(); }
          level = levelAt(c.env, (ph - c.startAt) * 1000 * c.rate) * 0.3; // the avatar multiplies by ~3.4
          break;
        }
        if (ph > c.endAt && !c.started) { c.started = true; c.onStart?.(); } // a very short clip that fell between two frames
      }
      const dbg = (globalThis as { __pfSync?: unknown[] }).__pfSync;
      if (dbg) dbg.push({ t: performance.now(), ph, level });
      this.levelListeners.forEach((cb) => cb(level));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
