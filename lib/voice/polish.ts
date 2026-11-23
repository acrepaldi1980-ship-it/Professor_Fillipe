// Light, free "studio" finish for synthetic speech: removes rumble, adds a little warmth, softens harsh sibilance, evens out the level and
// leaves a natural breath of silence at the end. Pure DSP on float samples (no native code), so it runs anywhere and costs a few milliseconds.
interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ audio-EQ-cookbook filters. */
function biquad(kind: "hp" | "lowshelf" | "highshelf" | "peak", f0: number, sr: number, gainDb = 0, q = 0.707): Biquad {
  const A = Math.pow(10, gainDb / 40), w = (2 * Math.PI * f0) / sr, cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * q), sq = 2 * Math.sqrt(A) * alpha;
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (kind === "hp") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  else if (kind === "lowshelf") { b0 = A * ((A + 1) - (A - 1) * cos + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cos); b2 = A * ((A + 1) - (A - 1) * cos - sq); a0 = (A + 1) + (A - 1) * cos + sq; a1 = -2 * ((A - 1) + (A + 1) * cos); a2 = (A + 1) + (A - 1) * cos - sq; }
  else if (kind === "highshelf") { b0 = A * ((A + 1) + (A - 1) * cos + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - sq); a0 = (A + 1) - (A - 1) * cos + sq; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - sq; }
  else { b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function run(x: Float32Array, c: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

export interface PolishOptions { /** silence kept after the clip, seconds (a breath between sentences) */ tail?: number; /** target RMS of the speech, dBFS */ rmsDb?: number }

export function polishSpeech(samples: Float32Array, sr: number, opts: PolishOptions = {}): Float32Array {
  if (samples.length === 0) return samples;
  let x = samples;
  x = run(x, biquad("hp", 70, sr));                 // rumble and plosive thumps
  x = run(x, biquad("lowshelf", 180, sr, 2.5));     // body: a warmer, fuller voice
  x = run(x, biquad("peak", 3200, sr, 1.2, 0.9));   // a touch of presence for clarity
  x = run(x, biquad("highshelf", 6500, sr, -3));    // softer "s" and hiss, less synthetic edge
  // gentle dynamics: a slow gain follower brings quiet words up and loud ones down, so the voice sits at one comfortable level
  const target = Math.pow(10, (opts.rmsDb ?? -20) / 20), win = Math.max(1, Math.round(sr * 0.05));
  const out = new Float32Array(x.length);
  let env = target, e2 = 0;
  for (let i = 0; i < x.length; i++) {
    e2 += x[i] * x[i];
    if (i >= win) e2 -= x[i - win] * x[i - win];
    const rms = Math.sqrt(Math.max(e2, 0) / win);
    const want = rms > 0.003 ? Math.min(2.2, Math.max(0.5, target / rms)) : 1; // do not boost silence or breath noise
    const k = want < env ? 0.002 : 0.0004;                                     // quick to turn down, slow to turn up
    env += (want - env) * k;
    out[i] = x[i] * env;
  }
  // soft limiter and peak guard, then short fades so clips join without clicks
  let peak = 0;
  for (let i = 0; i < out.length; i++) { out[i] = Math.tanh(out[i] * 1.1) / Math.tanh(1.1); peak = Math.max(peak, Math.abs(out[i])); }
  const g = peak > 0 ? 0.89 / peak : 1;
  const fade = Math.round(sr * 0.008), tail = Math.round(sr * (opts.tail ?? 0.12));
  const res = new Float32Array(out.length + tail);
  for (let i = 0; i < out.length; i++) res[i] = out[i] * g * Math.min(1, i / fade, (out.length - i) / fade);
  return res;
}

/** Pause to leave after a sentence, by how it ends: a full stop breathes longer than a comma. */
export const pauseAfter = (sentence: string): number => (/[.!]["”')\]]*\s*$/.test(sentence) ? 0.28 : /\?["”')\]]*\s*$/.test(sentence) ? 0.34 : /[;:]\s*$/.test(sentence) ? 0.2 : 0.12);
