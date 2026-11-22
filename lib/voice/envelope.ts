// Mouth envelope computed from the real audio of a sentence (RF-M17-02). The player reads it at the position that is audible RIGHT NOW (the audio clock,
// compensated for the output delay), so the mouth moves with the sound, not with a guess: no drift, no lag, silence means a closed mouth.
export const HOP_MS = 10;

export interface Envelope {
  /** Level 0..1 for every HOP_MS of the clip. */
  values: Float32Array;
  hopMs: number;
  durationMs: number;
}

/** RMS per 20 ms window every 10 ms, then a gentle attack/release (the jaw opens fast and closes a little slower) and scaled to the clip's loud parts. */
export function computeEnvelope(samples: Float32Array, sampleRate: number): Envelope {
  const hop = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
  const win = hop * 2;
  const n = Math.max(1, Math.ceil(samples.length / hop));
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i * hop - Math.floor(hop / 2));
    const end = Math.min(samples.length, start + win);
    let sum = 0;
    for (let k = start; k < end; k++) sum += samples[k] * samples[k];
    rms[i] = end > start ? Math.sqrt(sum / (end - start)) : 0;
  }
  // reference: the 90th percentile of the non-silent windows, so quiet and loud voices open the mouth alike
  const loud = Array.from(rms).filter((v) => v > 0.004).sort((a, b) => a - b);
  const ref = Math.max(0.02, loud.length ? loud[Math.floor(loud.length * 0.9)] : 0.1);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const target = rms[i] < 0.004 ? 0 : Math.min(1, rms[i] / ref);
    prev = target > prev ? prev + (target - prev) * 0.85 : prev + (target - prev) * 0.45;
    out[i] = prev < 0.02 ? 0 : prev;
  }
  return { values: out, hopMs: HOP_MS, durationMs: (samples.length / sampleRate) * 1000 };
}

/** The level at `tMs` from the start of the clip (linear interpolation); 0 outside the clip. */
export function levelAt(env: Envelope, tMs: number): number {
  if (tMs < 0 || tMs > env.durationMs) return 0;
  const x = tMs / env.hopMs, i = Math.floor(x), f = x - i;
  const a = env.values[i] ?? 0, b = env.values[i + 1] ?? a;
  return a + (b - a) * f;
}
