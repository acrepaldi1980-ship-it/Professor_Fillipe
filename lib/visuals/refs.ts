// Reference images (free: public domain, CC0 or CC BY from Wikimedia Commons) that guide the realistic look of a scene.
// The files live in lib/visuals/refs/ with refs.json (credits). A scene prompt is matched by keywords; the matching images are sent
// to the image model as visual references. The credits appear on "Fontes e licenças".
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RefImage {
  tag: string;
  file: string;
  title: string;
  license: string;
  author: string;
  source: string;
}

const KEYWORDS: Record<string, RegExp> = {
  galilee_sunrise: /\b(galilee|galileia|fisher|boat|barco|lake|kinneret|net|nets|capernaum|bethsaida|tiberias)\b/i,
  judean_desert: /\b(desert|deserto|wilderness|judea|jordan|jericho|temptation|tentacao|john the baptist|sinai)\b/i,
  ark_engraving: /\b(ark|arca|covenant|alian[cç]a|mercy seat|cherub)/i,
  ark_tissot: /\b(ark|arca|covenant|alian[cç]a|tabernacle|tabern[aá]culo|temple|templo)\b/i,
};

let cache: RefImage[] | null = null;
function all(): RefImage[] {
  if (cache) return cache;
  try {
    const dir = join(process.cwd(), "lib/visuals/refs");
    cache = existsSync(join(dir, "refs.json")) ? (JSON.parse(readFileSync(join(dir, "refs.json"), "utf8")) as RefImage[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** Up to `max` reference images whose subject matches the prompt. */
export function referencesFor(prompt: string, max = 2): (RefImage & { b64: string })[] {
  const out: (RefImage & { b64: string })[] = [];
  for (const r of all()) {
    if (out.length >= max) break;
    if (!KEYWORDS[r.tag]?.test(prompt)) continue;
    try {
      out.push({ ...r, b64: readFileSync(join(process.cwd(), "lib/visuals/refs", r.file)).toString("base64") });
    } catch {
      /* file missing: skip */
    }
  }
  return out;
}

export const allRefCredits = (): RefImage[] => all();
