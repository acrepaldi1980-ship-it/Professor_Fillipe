// Image generation behind an adapter (D-05, decided 21/11/2026: Gemini Imagen). Needs GEMINI_API_KEY with billing credit.
import sharp from "sharp";

export interface ImageProvider {
  readonly name: string;
  /** Returns a webp image (max 800 px wide) as base64. */
  generate(prompt: string): Promise<{ b64: string; mime: string }>;
}

export class GeminiImagenProvider implements ImageProvider {
  readonly name = "gemini-imagen";
  async generate(prompt: string) {
    const model = process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-fast-generate-001";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
      method: "POST",
      signal: AbortSignal.timeout(40000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "proxy-injected" },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: "4:3", personGeneration: "allow_adult" } }),
    });
    if (!res.ok) throw new Error(`image_failed_${res.status}`);
    const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("image_empty");
    const webp = await sharp(Buffer.from(b64, "base64")).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    return { b64: webp.toString("base64"), mime: "image/webp" };
  }
}

export const imageProvider = (): ImageProvider => new GeminiImagenProvider();
