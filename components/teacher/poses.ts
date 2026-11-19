// Final avatar art (D-18, supplied by the owner, 19/11/2026): a stylized 3D scholar in four poses.
// Images are cut-outs on a 700x1000 canvas; `cx` is the horizontal centre of the head in canvas pixels (for the head crops).
export type PoseId = "welcome" | "teach" | "teachHand" | "cheer" | "think" | "care";

export const POSES: Record<PoseId, { src: string; cx: number }> = {
  welcome: { src: "/avatar/boas-vindas.webp", cx: 381 },
  teach: { src: "/avatar/ensinando.webp", cx: 287 },
  teachHand: { src: "/avatar/ensinando-mao.webp", cx: 431 },
  cheer: { src: "/avatar/parabens.webp", cx: 439 },
  think: { src: "/avatar/refletindo.webp", cx: 321 },
  care: { src: "/avatar/acolhimento.webp", cx: 370 }, // hand on the chest: welcome, empathy
};

export const CANVAS = { w: 700, h: 1000 };
