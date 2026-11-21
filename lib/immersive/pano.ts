// 360° photo tours (Prompt 3.5b): real equirectangular photos with navigation by points, like street view. Angles are in degrees:
// yaw 0 = the photo's center, growing to the right; pitch 0 = the horizon, positive up.
import { z } from "zod";
import { detailRefs } from "./refs";

const id = z.string().regex(/^[a-z0-9_]{2,40}$/);
const ref = z.string().regex(/^[A-Z0-9]{3}\.\d{1,3}(\.\d{1,3})?(-\d{1,3})?$/);
const yaw = z.number().min(-180).max(180);
const pitch = z.number().min(-90).max(90);

export const PanoHotspot = z.object({ id, label: z.string().min(2).max(60), text: z.string().min(5).max(600), refs: z.array(ref).max(6).default([]), yaw, pitch });
export const PanoLink = z.object({ to: id, label: z.string().min(2).max(60), yaw, pitch: pitch.default(-12),
  /** Where to face on arrival; without it, the destination's startYaw. */
  arriveYaw: yaw.optional() });
export const PanoScene = z.object({
  id,
  title: z.string().min(2).max(80),
  /** URL of the equirectangular image (2:1), 4096 px wide is the sweet spot for phones. */
  image: z.string().min(1).max(300),
  /** Credit is mandatory: author, license and source of the photo. */
  credit: z.object({ author: z.string().min(2).max(120), license: z.string().min(2).max(60), source: z.string().min(2).max(300) }),
  /** Where the visitor faces when arriving by default. */
  startYaw: yaw.default(0),
  hotspots: z.array(PanoHotspot).max(20).default([]),
  links: z.array(PanoLink).max(12).default([]),
  /** What the guide says on arrival (optional, ≤ 120 words, ends with a question). */
  script: z.string().max(900).optional(),
});
export const PanoTour = z.object({
  id,
  title: z.string().min(3).max(80),
  era: z.string().min(3).max(160),
  refs: z.array(ref).max(12).default([]),
  start: id,
  scenes: z.array(PanoScene).min(1).max(40),
  sheet: z.object({ summary: z.string().min(10).max(1200), sources: z.array(z.string().min(3).max(200)).min(1).max(12), uncertainty: z.string().max(400).optional() }),
}).superRefine((p, ctx) => {
  const ids = new Set(p.scenes.map((s) => s.id));
  if (ids.size !== p.scenes.length) ctx.addIssue({ code: "custom", message: "duplicate scene id" });
  if (!ids.has(p.start)) ctx.addIssue({ code: "custom", message: "unknown start scene" });
  for (const s of p.scenes) for (const l of s.links) if (!ids.has(l.to)) ctx.addIssue({ code: "custom", message: `scene ${s.id}: link to unknown scene ${l.to}` });
});
export type PanoTour = z.infer<typeof PanoTour>;
export type PanoScene = z.infer<typeof PanoScene>;

const rad = (d: number) => (d * Math.PI) / 180;
/** Unit direction (x right, y up, z toward the viewer's back) for a yaw/pitch in degrees; yaw 0 looks at -z. */
export function dirFromAngles(y: number, p: number): [number, number, number] {
  return [Math.sin(rad(y)) * Math.cos(rad(p)), Math.sin(rad(p)), -Math.cos(rad(y)) * Math.cos(rad(p))];
}
/** Smallest signed difference between two yaw angles, in degrees (−180..180]. */
export function yawDiff(a: number, b: number): number { let d = (a - b) % 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; }
/** Angle in degrees between two directions given by yaw/pitch. */
export function angleBetween(y1: number, p1: number, y2: number, p2: number): number {
  const a = dirFromAngles(y1, p1), b = dirFromAngles(y2, p2);
  return (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
}
/** The pin the visitor is looking at (within `cone` degrees of the gaze), the closest one, or null. */
export function lookedAt<T extends { yaw: number; pitch: number }>(items: T[], gazeYaw: number, gazePitch: number, cone = 14): T | null {
  let best: T | null = null, bestA = cone;
  for (const it of items) { const a = angleBetween(gazeYaw, gazePitch, it.yaw, it.pitch); if (a <= bestA) { best = it; bestA = a; } }
  return best;
}
/** Text for the teacher about where the student is; built on the server from the registered tour (never trusted from the browser). */
export function panoContext(tour: PanoTour, s: { scene: string; hotspot?: string | null; yaw?: number; pitch?: number }): { text: string; refs: string[] } {
  const sc = tour.scenes.find((x) => x.id === s.scene) ?? tour.scenes[0];
  const hs = s.hotspot ? sc.hotspots.find((h) => h.id === s.hotspot) : s.yaw != null ? lookedAt(sc.hotspots, s.yaw, s.pitch ?? 0, 20) : null;
  const lines = [
    `AMBIENTE IMERSIVO (fotos 360° reais): o aluno está olhando uma fotografia panorâmica de "${sc.title}" (${tour.title}, ${tour.era}). Você é o guia dele.`,
    `Crédito da foto: ${sc.credit.author}, ${sc.credit.license}. É uma foto de HOJE: o que se vê são ruínas ou o lugar atual, não a cidade como era na época bíblica.`,
    hs ? `Ele está olhando para: "${hs.label}": ${hs.text} (${hs.refs.join(", ") || "sem versículo"}).` : "",
    sc.hotspots.length ? `Pontos de interesse nesta foto: ${sc.hotspots.map((h) => `"${h.label}"`).join(", ")}.` : "",
    sc.links.length ? `Daqui ele pode ir para: ${sc.links.map((l) => `"${l.label}"`).join(", ")}.` : "",
    `FICHA HISTÓRICA (fonte do que você pode afirmar): ${tour.sheet.summary} Fontes: ${tour.sheet.sources.join("; ")}.${tour.sheet.uncertainty ? ` Incerteza: ${tour.sheet.uncertainty}` : ""}`,
    "REGRAS DO GUIA: responda no contexto do lugar, em falas curtas, terminando com pergunta ou convite para olhar algo. Só afirme o que está na ficha, nos pontos de interesse ou nas fontes recuperadas; diga com naturalidade quando a foto não mostra algo. Nunca descreva rosto de Jesus nem represente Deus Pai (RA-20).",
  ].filter(Boolean);
  const refs = [...(hs?.refs ?? []), ...sc.hotspots.flatMap((h) => h.refs)];
  return { text: lines.join("\n"), refs: [...new Set(refs)].slice(0, 8).flatMap(detailRefs) };
}

/** Where a pin at (yaw, pitch) lands on the screen for a camera looking at (camYaw, camPitch) with vertical field of view `fovV` (degrees): x, y in 0..1 from the top-left, or null when behind the viewer. */
export function project(yawDeg: number, pitchDeg: number, camYaw: number, camPitch: number, fovV: number, aspect: number): { x: number; y: number } | null {
  const d = dirFromAngles(yawDeg, pitchDeg);
  const cy = rad(camYaw), cp = rad(camPitch);
  // camera basis: forward, right, up
  const f = [Math.sin(cy) * Math.cos(cp), Math.sin(cp), -Math.cos(cy) * Math.cos(cp)];
  const r = [Math.cos(cy), 0, Math.sin(cy)];
  const u = [-Math.sin(cy) * Math.sin(cp), Math.cos(cp), Math.cos(cy) * Math.sin(cp)];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  if (z <= 0.05) return null;
  const t = Math.tan(rad(fovV) / 2);
  const x = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (z * t * aspect);
  const y = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (z * t);
  return { x: 0.5 + x / 2, y: 0.5 - y / 2 };
}
