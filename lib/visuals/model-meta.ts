// Validation of a 3D model added from /admin (Prompt 2.6). Shared by the API route and the admin screen.
import { z } from "zod";

export const MAX_GLB = 3_500_000; // light enough for a mid-range phone on mobile data
const REF = /^[0-9A-Z]{3}\.\d+(\.\d+)?(-[0-9A-Z]{3}\.\d+(\.\d+)?)?$/;
const num = z.number().finite().min(-60).max(60);

export const ModelMeta = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/),
  name: z.string().trim().min(3).max(80),
  alt: z.string().trim().min(30).max(600),
  note: z.string().trim().min(10).max(900),
  theme: z.string().trim().min(2).max(40),
  refs: z.array(z.string().regex(REF)).max(10).default([]),
  camera: z.tuple([num, num, num]).default([4, 3, 6]),
  hotspots: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/), label: z.string().trim().min(2).max(60), text: z.string().trim().min(5).max(500), refs: z.array(z.string().regex(REF)).max(5).default([]), at: z.tuple([num, num, num]) })).max(12).default([]),
  license: z.string().trim().min(3).max(120),
  sources: z.array(z.string().trim().min(3).max(300)).min(1).max(8),
  active: z.boolean().default(true),
});
export type ModelMeta = z.infer<typeof ModelMeta>;


// RA-20 for the texts of a model: the app never shows the face of Jesus or represents God the Father, and refuses violent or sexual content.
// (Mentioning Jesus or the Father in a verse or a note is fine; what is refused is describing a face or a bodily figure.)
const JESUS = /\b(jesus|cristo|christ|messias|nazareno)\b/i;
const FACE = /\b(face|faces|rosto|rostos|retrato|portrait|close[- ]?up|olhos|eyes|barba|beard|sorrindo|smiling)\b/i;
const FATHER = /\b(deus pai|god the father|pai celestial|ancião de dias|ancient of days)\b/i;
const FIGURE = /\b(figura|imagem|est[aá]tua|sentado|mãos?|hands?|statue|figure|seated|sitting|barba|beard|rosto|face)\b/i;
const BANNED = /\b(nu[ad]?|nudez|nude|naked|sexual|er[oó]tic\w*|gore|mutil\w*|decapit\w*|swastika|caricatur\w*)\b/i;
export const violatesRa20 = (text: string) => BANNED.test(text) || (JESUS.test(text) && FACE.test(text)) || (FATHER.test(text) && FIGURE.test(text));
