// Natural mouth for the avatar (RF-M17-02). The four face images of the art are different renders (other head angle, beard, hair), so
// cross-dissolving them morphs the face ("distorted"). Here ONE image is used and only the lower jaw moves: the rows under the lip line
// slide down by a smooth taper (largest at the middle of the mouth, zero at the corners), and the opening shows the inside of the mouth.
// Pure drawing code so it can be tested without a browser framework.

export interface MouthSpec {
  /** Canvas size of the face image. */
  w: number;
  h: number;
  /** Middle of the mouth and half width (px of the image). */
  cx: number;
  /** y of the lip line at the middle and how much higher the corners are (smile). */
  lipY: number;
  corner: number;
  halfW: number;
  /** Largest jaw drop (px of the image). */
  maxDrop: number;
  /** The jaw (beard and chin) is wider than the mouth: its half width, and how tall the moving part is (lip line to just under the beard). */
  jawHalfW: number;
  jawH: number;
}

/** rosto-fechada.webp (800x800): closed mouth under the moustache, lip line at y~427, corners ~9 px higher. */
export const FACE_MOUTH: MouthSpec = { w: 800, h: 800, cx: 404, lipY: 427, corner: 9, halfW: 64, maxDrop: 40, jawHalfW: 104, jawH: 160 };

const STRIP = 3;
const lipLine = (m: MouthSpec, x: number) => {
  const u = Math.min(1, Math.abs(x - m.cx) / m.halfW);
  return m.lipY - m.corner * u * u;
};
/** 1 in the middle of the mouth, 0 at the corners: a smooth cos^2 taper. */
export const taper = (m: MouthSpec, x: number) => {
  const u = Math.abs(x - m.cx) / m.halfW;
  return u >= 1 ? 0 : Math.cos((u * Math.PI) / 2) ** 2;
};

/** Jaw weight across the face: 1 under the middle of the mouth, 0 at the edges of the beard. */
export const jawTaper = (m: MouthSpec, x: number) => {
  const u = Math.abs(x - m.cx) / m.jawHalfW;
  return u >= 1 ? 0 : Math.cos((u * Math.PI) / 2) ** 2;
};

/**
 * Draws the face with the jaw dropped by `drop` pixels (0 = the original closed mouth).
 * Only the lower face moves: the beard and chin (from the lip line to just under the beard) are copied down, so the jaw swings open while the NECK
 * and the shoulders stay still. The bottom edge of the copy is feathered into the neck so no seam shows.
 */
export function drawFace(ctx: CanvasRenderingContext2D, img: CanvasImageSource, m: MouthSpec, drop: number) {
  ctx.clearRect(0, 0, m.w, m.h);
  ctx.drawImage(img, 0, 0, m.w, m.h);
  if (drop < 0.6) return;
  const x0 = Math.floor(m.cx - m.jawHalfW), x1 = Math.ceil(m.cx + m.jawHalfW), FEATHER = 5, SLICE = 4;
  for (let x = x0; x < x1; x += STRIP) {
    const mid = x + STRIP / 2;
    const dy = drop * jawTaper(m, mid);
    if (dy < 0.4) continue;
    const y = lipLine(m, mid);
    // the opening: inside of the mouth within the lips; dark beard colour at the sides, so the beard does not show a hole
    const inMouth = Math.abs(mid - m.cx) < m.halfW;
    const g = ctx.createLinearGradient(0, y - 1, 0, y + dy + 1);
    if (inMouth) {
      g.addColorStop(0, dy > 7 ? "#efe3d2" : "#3a1410");
      g.addColorStop(dy > 7 ? 0.28 : 0.1, "#3a1410");
      g.addColorStop(0.72, "#4a1a15");
      g.addColorStop(1, dy > 12 ? "#8e4540" : "#4a1a15");
    } else { g.addColorStop(0, "#2a1912"); g.addColorStop(1, "#2c1a14"); }
    ctx.fillStyle = g;
    if (inMouth) ctx.fillRect(x, y - 1, STRIP + 0.5, dy + 2);
    else ctx.fillRect(x, y + 1.5, STRIP + 0.5, Math.max(0, dy - 0.5)); // at the sides start under the lip crease: no dark line past the corners
    // the jaw: beard and chin moved down as one piece
    const body = m.jawH - FEATHER * SLICE;
    ctx.drawImage(img, x, y, STRIP + 0.5, body, x, y + dy, STRIP + 0.5, body);
    // feathered lower edge: each thin slice is a little more transparent, blending the beard bottom into the still neck
    for (let k = 0; k < FEATHER; k++) {
      ctx.globalAlpha = 1 - (k + 1) / (FEATHER + 1);
      const sy = y + body + k * SLICE;
      ctx.drawImage(img, x, sy, STRIP + 0.5, SLICE, x, sy + dy, STRIP + 0.5, SLICE);
    }
    ctx.globalAlpha = 1;
  }
}

export interface Motion {
  /** Jaw opening 0..1 (follows the speech level). */
  drop: number;
  /** Head tilt in degrees. */
  nod: number;
  /** Head rise in px. */
  bob: number;
  /** Slow measure of how much he has been speaking lately (0..1): the head only becomes a little more alive, it never follows single syllables. */
  act: number;
}

/**
 * Smoothing of the jaw (fast to open, slower to close) and a calm, natural head.
 * The head must NOT follow the syllables (that read as a trembling neck): it moves with two slow, unrelated swings (periods ~5 s and ~8 s) and a slow
 * breath; speaking only raises their amplitude gradually. Returns the new values.
 */
export function stepMotion(s: { drop: number; nod?: number; bob?: number; act?: number }, level: number, speaking: boolean, t: number): Motion {
  const target = speaking ? Math.min(1, level * 3.4) : 0;
  const drop = s.drop + (target - s.drop) * (target > s.drop ? 0.75 : 0.35);
  // activity: a ~1 s low-pass of "is speaking", so the head's life changes smoothly when speech starts and stops
  const act = (s.act ?? 0) + ((speaking ? 1 : 0) - (s.act ?? 0)) * 0.025;
  const sec = t / 1000;
  const sway = Math.sin(sec * 1.25) * 0.55 + Math.sin(sec * 0.78 + 1.3) * 0.35; // two slow swings
  const breath = Math.sin(sec * 1.5);
  // at rest the page already breathes (CSS); the head only comes alive, gently, while he speaks
  const nodTarget = sway * 0.5 * act;
  const bobTarget = breath * 0.45 * act;
  const nod = (s.nod ?? 0) + (nodTarget - (s.nod ?? 0)) * 0.1;
  const bob = (s.bob ?? 0) + (bobTarget - (s.bob ?? 0)) * 0.1;
  return { drop, nod, bob, act };
}
