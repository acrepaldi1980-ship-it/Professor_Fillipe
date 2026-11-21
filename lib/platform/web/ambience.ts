import type { Ambience, AmbienceLayer } from "../types";

/** Procedural ambient and spatial sound with Web Audio (no audio files to download): filtered noise for wind, camp murmur and fire. */
export class WebAmbience implements Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private spatial = new Map<string, { panner: PannerNode; gain: GainNode; base: number; radius: number; at: [number, number, number] }>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private nodes: AudioNode[] = [];

  isSupported() {
    return typeof window !== "undefined" && "AudioContext" in window;
  }

  private noise(ctx: AudioContext, seconds = 4): AudioBufferSourceNode {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brown-ish noise
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  async start(layers: AmbienceLayer[]) {
    if (!this.isSupported()) return;
    this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 1; master.connect(ctx.destination);
    this.master = master;
    for (const l of layers) {
      const src = this.noise(ctx);
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      gain.gain.value = l.volume;
      if (l.layer === "wind") { filter.type = "lowpass"; filter.frequency.value = 500; const lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 250; lfo.connect(lg); lg.connect(filter.frequency); lfo.start(); this.nodes.push(lfo, lg); }
      else if (l.layer === "fire") { filter.type = "bandpass"; filter.frequency.value = 1800; filter.Q.value = 0.6; this.timers.push(setInterval(() => { gain.gain.setTargetAtTime(l.volume * (0.4 + Math.random() * 0.9), ctx.currentTime, 0.03); }, 90)); }
      else { filter.type = "bandpass"; filter.frequency.value = l.layer === "murmur" ? 380 : 700; filter.Q.value = 0.9; this.timers.push(setInterval(() => { gain.gain.setTargetAtTime(l.volume * (0.5 + Math.random() * 0.5), ctx.currentTime, 0.4); }, 700)); }
      src.connect(filter); filter.connect(gain);
      if (l.kind === "spatial" && l.at) {
        const panner = ctx.createPanner();
        panner.panningModel = "HRTF"; panner.distanceModel = "inverse"; panner.refDistance = 1.5; panner.maxDistance = l.radius ?? 12; panner.rolloffFactor = 1.4;
        panner.positionX.value = l.at[0]; panner.positionY.value = l.at[1]; panner.positionZ.value = l.at[2];
        gain.connect(panner); panner.connect(master);
        this.spatial.set(l.id, { panner, gain, base: l.volume, radius: l.radius ?? 12, at: l.at });
      } else gain.connect(master);
      src.start();
      this.nodes.push(src, filter, gain);
    }
    if (ctx.state === "suspended") await ctx.resume();
  }

  setListener(pos: [number, number, number], yaw: number) {
    const l = this.ctx?.listener;
    if (!l || !this.ctx) return;
    const t = this.ctx.currentTime;
    l.positionX.setValueAtTime(pos[0], t); l.positionY.setValueAtTime(pos[1], t); l.positionZ.setValueAtTime(pos[2], t);
    l.forwardX.setValueAtTime(-Math.sin(yaw), t); l.forwardY.setValueAtTime(0, t); l.forwardZ.setValueAtTime(-Math.cos(yaw), t);
    l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    // beyond its radius a spatial sound is silent (the panner's own roll-off never reaches zero)
    for (const s of this.spatial.values()) {
      const d = Math.hypot(pos[0] - s.at[0], pos[2] - s.at[2]);
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setTargetAtTime(d > s.radius ? 0 : s.base, t, 0.15);
    }
  }

  setMuted(muted: boolean) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  stop() {
    this.timers.forEach(clearInterval); this.timers = [];
    for (const n of this.nodes) { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* already */ } }
    this.nodes = []; this.spatial.clear();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null; this.master = null;
  }
}
