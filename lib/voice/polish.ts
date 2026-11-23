// Light, free "studio" finish for synthetic speech: removes rumble, adds a little warmth, softens harsh sibilance, evens out the level and
// leaves a natural breath of silence at the end. Pure DSP on float samples (no native code), so it runs anywhere and costs a few milliseconds.
interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** RBJ audio-EQ-cookbook filters. */
function biquad(kind: "hp" | "lp" | "lowshelf" | "highshelf" | "peak", f0: number, sr: number, gainDb = 0, q = 0.707): Biquad {
  const A = Math.pow(10, gainDb / 40), w = (2 * Math.PI * f0) / sr, cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * q), sq = 2 * Math.sqrt(A) * alpha;
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (kind === "lp") { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  else if (kind === "hp") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
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

/** Pitch-and-pace change by resampling (cubic): ratio < 1 lowers the voice, deepens the formants (a bigger, "broadcast" chest) and slows it by 1/ratio. */
export function resample(x: Float32Array, ratio: number): Float32Array {
  if (ratio === 1 || x.length < 4) return x;
  const n = Math.floor((x.length - 1) / ratio), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * ratio, k = Math.floor(t), f = t - k;
    const p0 = x[Math.max(0, k - 1)], p1 = x[k], p2 = x[k + 1], p3 = x[Math.min(x.length - 1, k + 2)];
    out[i] = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
  }
  return out;
}

/**
 * Tone that brings the Kokoro narrator voice to the timbre of the welcome video's narrator. Measured on the same text: the raw voice is dark and boomy
 * (brightness 1428 Hz, bass-to-treble 16.3 dB, a "giant" or cartoon colour); the video voice is at 1852 Hz and 10.8 dB. A little less bass and more presence
 * and air gets 1775 Hz and 9.4 dB.
 */
export const NARRATOR_TONE = { bass: -5, presence: 3.5, air: 2.5 } as const;

/** The Kokoro vocoder leaves a steady whistle at 4.8 kHz, at its double 9.6 kHz and near 10.6 kHz (tones 15 to 18 dB above their surroundings): it sounds like microphone feedback. */
export const KOKORO_WHISTLE_HZ = [4800, 9609, 9887, 10083, 10600, 11059] as const;

export interface PolishOptions {
  /** silence kept after the clip, seconds (a breath between sentences) */ tail?: number;
  /** target RMS of the speech, dBFS */ rmsDb?: number;
  /** broadcast announcer style: more chest (proximity bass) and presence, a steadier level */ announcer?: boolean;
  /** Explicit tone (dB). Overrides the presets: a negative `bass` lifts the boom off a voice that is already heavy, `presence` and `air` add clarity. */
  tone?: { bass: number; presence: number; air: number };
  /** Narrow cuts (Hz) for steady whistles; give them at the sample's own pitch scale (after any resampling the frequencies move). */
  notches?: readonly number[];
  /** Steep low-pass (Hz), two stages (24 dB per octave): speech has nothing useful above it, and the vocoder's whistles live there. */
  lowpassHz?: number;
  /** Highest peak of the result (0 to 1); default 0.89. Lower for a quieter voice. */
  peak?: number;
}

/** Drops the silence before the first sound (keeps 25 ms), so the voice starts the moment the clip does. */
export function trimLead(x: Float32Array, sr: number): Float32Array {
  const thr = 0.012, keep = Math.round(sr * 0.025);
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < thr) i++;
  return i > keep ? x.subarray(i - keep) : x;
}

export function polishSpeech(samples: Float32Array, sr: number, opts: PolishOptions = {}): Float32Array {
  if (samples.length === 0) return samples;
  let x = trimLead(samples, sr);
  if (opts.lowpassHz) { x = run(x, biquad("lp", opts.lowpassHz, sr, 0, 0.707)); x = run(x, biquad("lp", opts.lowpassHz, sr, 0, 0.707)); }
  for (const f of opts.notches ?? []) if (f < sr / 2.1) { x = run(x, biquad("peak", f, sr, -24, 18)); x = run(x, biquad("peak", f, sr, -12, 6)); }
  x = run(x, biquad("hp", 70, sr));                 // rumble and plosive thumps
  x = run(x, biquad("lowshelf", opts.tone ? 220 : opts.announcer ? 150 : 180, sr, opts.tone ? opts.tone.bass : opts.announcer ? 5 : 2.5)); // body: a warmer, fuller voice (announcer: close-microphone bass)
  x = run(x, biquad("peak", opts.tone ? 3000 : opts.announcer ? 2800 : 3200, sr, opts.tone ? opts.tone.presence : opts.announcer ? 2.2 : 1.2, 0.9)); // presence for clarity
  x = run(x, biquad("highshelf", opts.tone ? 5500 : 6500, sr, opts.tone ? opts.tone.air : opts.announcer ? -4.5 : -3)); // softer "s" and hiss, less synthetic edge (tone.air > 0: more brightness)
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
  const g = peak > 0 ? (opts.peak ?? 0.89) / peak : 1;
  const fade = Math.round(sr * 0.008), tail = Math.round(sr * (opts.tail ?? 0.12));
  const res = new Float32Array(out.length + tail);
  for (let i = 0; i < out.length; i++) res[i] = out[i] * g * Math.min(1, i / fade, (out.length - i) / fade);
  return res;
}

/** Pause to leave after a sentence, by how it ends: a full stop breathes longer than a comma. */
export const pauseAfter = (sentence: string): number => (/[.!]["”')\]]*\s*$/.test(sentence) ? 0.28 : /\?["”')\]]*\s*$/.test(sentence) ? 0.34 : /[;:]\s*$/.test(sentence) ? 0.2 : 0.12);

/** Cuts a sentence at commas, semicolons and colons into phrases of at least 3 words (shorter bits stay with the next one). */
export function splitPhrases(text: string): string[] {
  const raw = text.split(/(?<=[,;:])\s+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  let carry = "";
  for (const r of raw) {
    const cur = carry ? `${carry} ${r}` : r;
    if (cur.split(/\s+/).length < 3) carry = cur; else { out.push(cur); carry = ""; }
  }
  if (carry) { if (out.length) out[out.length - 1] += ` ${carry}`; else out.push(carry); }
  return out.length ? out : [text];
}
