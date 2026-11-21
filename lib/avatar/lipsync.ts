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
}

/** rosto-fechada.webp (800x800): closed mouth under the moustache, lip line at y~427, corners ~9 px higher. */
export const FACE_MOUTH: MouthSpec = { w: 800, h: 800, cx: 404, lipY: 427, corner: 9, halfW: 64, maxDrop: 17 };

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

/** Draws the face with the jaw dropped by `drop` pixels (0 = the original closed mouth). */
export function drawFace(ctx: CanvasRenderingContext2D, img: CanvasImageSource, m: MouthSpec, drop: number) {
  ctx.clearRect(0, 0, m.w, m.h);
  ctx.drawImage(img, 0, 0, m.w, m.h);
  if (drop < 0.6) return;
  const x0 = Math.floor(m.cx - m.halfW), x1 = Math.ceil(m.cx + m.halfW);
  for (let x = x0; x < x1; x += STRIP) {
    const mid = x + STRIP / 2;
    const dy = drop * taper(m, mid);
    if (dy < 0.4) continue;
    const y = lipLine(m, mid);
    // inside of the mouth: dark, with a hint of upper teeth under the moustache and of the tongue near the bottom
    const g = ctx.createLinearGradient(0, y - 1, 0, y + dy + 1);
    g.addColorStop(0, dy > 5 ? "#efe3d2" : "#3a1410");
    g.addColorStop(dy > 5 ? 0.3 : 0.1, "#3a1410");
    g.addColorStop(0.72, "#4a1a15");
    g.addColorStop(1, dy > 9 ? "#8e4540" : "#4a1a15");
    ctx.fillStyle = g;
    ctx.fillRect(x, y - 1, STRIP + 0.5, dy + 2);
    // the lower jaw: everything under the lip line of this strip, moved down
    ctx.drawImage(img, x, y, STRIP + 0.5, m.h - y, x, y + dy, STRIP + 0.5, m.h - y);
  }
}

/** Smoothing of the jaw (fast to open, slower to close) and of the head motion; returns the new values. */
export function stepMotion(s: { drop: number; nod: number }, level: number, speaking: boolean, t: number) {
  const target = speaking ? Math.min(1, level * 3.4) : 0;
  const drop = s.drop + (target - s.drop) * (target > s.drop ? 0.65 : 0.3);
  // a very small nod and sway while speaking, never abrupt
  const nodTarget = speaking ? Math.sin(t / 620) * 0.35 + drop * 0.6 : 0;
  const nod = s.nod + (nodTarget - s.nod) * 0.08;
  return { drop, nod };
}
