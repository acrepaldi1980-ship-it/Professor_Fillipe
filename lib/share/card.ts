// Visual card of a verse or of something learned, to share on WhatsApp and Instagram (Prompt 2.7). Drawn on a canvas on the device: no server,
// no image service, nothing leaves the phone until the student chooses to share. The card always carries the credit of the Bible version and the
// link of the app (with the student's referral code when they have one).
export interface CardOptions {
  /** The main text: a verse or a short learning. */
  text: string;
  /** Reference line, e.g. "João 3:16" or "O que aprendi hoje". */
  title: string;
  /** Credit line, e.g. "Bíblia Livre 2018 (CC BY)". */
  credit?: string;
  /** Link shown at the bottom. */
  link: string;
  width?: number;
  height?: number;
}

/** Breaks a text into lines no wider than `maxWidth`, using `measure` to size words (so it is testable without a canvas). */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (measure(next) <= maxWidth || !cur) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Largest font size (in px, from `max` down to `min`) at which the text fits in the box. */
export function fitFont(text: string, boxW: number, boxH: number, measureAt: (size: number, s: string) => number, max = 64, min = 28, lineHeight = 1.35): { size: number; lines: string[] } {
  for (let size = max; size >= min; size -= 2) {
    const lines = wrapLines(text, boxW, (s) => measureAt(size, s));
    if (lines.length * size * lineHeight <= boxH) return { size, lines };
  }
  const size = min;
  const all = wrapLines(text, boxW, (s) => measureAt(size, s));
  const maxLines = Math.max(1, Math.floor(boxH / (size * lineHeight)));
  const lines = all.slice(0, maxLines);
  if (all.length > maxLines) lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s.,;:]*$/, "") + "…";
  return { size, lines };
}

const BG = "#faf3e3", INK = "#2e2a24", PRIMARY = "#b4532a", MUTED = "#6b645a";

export function drawCard(ctx: CanvasRenderingContext2D, o: CardOptions) {
  const W = o.width ?? 1080, H = o.height ?? 1350, pad = 90;
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PRIMARY; ctx.fillRect(0, 0, W, 24); ctx.fillRect(0, H - 24, W, 24);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PRIMARY; ctx.font = "700 40px Georgia, serif"; ctx.fillText("Professor Filipe", pad, 140);
  ctx.fillStyle = MUTED; ctx.font = "400 30px sans-serif"; ctx.fillText("Entendes o que lês?", pad, 188);
  // big quotation mark
  ctx.fillStyle = PRIMARY; ctx.globalAlpha = 0.25; ctx.font = "700 220px Georgia, serif"; ctx.fillText("“", pad - 10, 400); ctx.globalAlpha = 1;
  const boxW = W - pad * 2, top = 330, boxH = H - top - 330;
  const { size, lines } = fitFont(o.text, boxW, boxH, (s, w) => { ctx.font = `400 ${s}px Georgia, serif`; return ctx.measureText(w).width; });
  ctx.fillStyle = INK; ctx.font = `400 ${size}px Georgia, serif`;
  const lh = size * 1.35;
  lines.forEach((l, i) => ctx.fillText(l, pad, top + size + i * lh));
  const endY = top + size + (lines.length - 1) * lh;
  ctx.fillStyle = PRIMARY; ctx.font = "700 44px Georgia, serif"; ctx.fillText(`— ${o.title}`, pad, Math.min(endY + 90, H - 250));
  if (o.credit) { ctx.fillStyle = MUTED; ctx.font = "400 28px sans-serif"; ctx.fillText(o.credit, pad, H - 170); }
  ctx.fillStyle = INK; ctx.font = "600 32px sans-serif"; ctx.fillText(o.link.replace(/^https?:\/\//, ""), pad, H - 110);
}

/** Renders the card to a PNG. Browser only (uses a canvas). */
export function renderCard(o: CardOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = o.width ?? 1080; canvas.height = o.height ?? 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no_canvas"));
  drawCard(ctx, o);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no_blob"))), "image/png"));
}
