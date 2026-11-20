// Image generation behind an adapter (D-05: Gemini). The default model, gemini-2.5-flash-image, accepts reference images, which
// guide the realistic look of a scene (see refs.ts); Imagen is kept as an alternative (IMAGE_MODEL=imagen-...). Needs credit.
import sharp from "sharp";

export interface ImageRequest {
  prompt: string;
  /** Free reference images (base64 jpeg) that show what the place, object or light should look like. */
  references?: { b64: string; mime?: string }[];
}
export interface ImageProvider {
  readonly name: string;
  /** Returns a webp image (max 800 px wide) as base64. */
  generate(req: ImageRequest | string): Promise<{ b64: string; mime: string }>;
}

const KEY = () => process.env.GEMINI_API_KEY ?? "proxy-injected";
const toWebp = async (b64: string) => ({ b64: (await sharp(Buffer.from(b64, "base64")).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer()).toString("base64"), mime: "image/webp" });

export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini-image";
  async generate(req: ImageRequest | string) {
    const { prompt, references = [] } = typeof req === "string" ? { prompt: req } : req;
    const model = process.env.IMAGE_MODEL ?? "gemini-2.5-flash-image";
    const guide = references.length ? "Use the attached photos only as visual reference for the landscape, light, materials and architecture; do not copy people or any text. " : "";
    const parts = [
      ...references.map((r) => ({ inlineData: { mimeType: r.mime ?? "image/jpeg", data: r.b64 } })),
      { text: `${guide}${prompt}` },
    ];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(50000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } }),
    });
    if (!res.ok) throw new Error(`image_failed_${res.status}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
    const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) throw new Error("image_empty");
    return toWebp(b64);
  }
}

/** Alternative: Imagen (no reference images). */
export class ImagenProvider implements ImageProvider {
  readonly name = "imagen";
  async generate(req: ImageRequest | string) {
    const prompt = typeof req === "string" ? req : req.prompt;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.IMAGE_MODEL ?? "imagen-4.0-fast-generate-001"}:predict`, {
      method: "POST",
      signal: AbortSignal.timeout(40000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY() },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: "4:3", personGeneration: "allow_adult" } }),
    });
    if (!res.ok) throw new Error(`image_failed_${res.status}`);
    const b64 = ((await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] }).predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("image_empty");
    return toWebp(b64);
  }
}

export const imageProvider = (): ImageProvider => ((process.env.IMAGE_MODEL ?? "").startsWith("imagen") ? new ImagenProvider() : new GeminiImageProvider());
