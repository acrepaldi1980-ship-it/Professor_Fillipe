// GET /api/v1/bible/original/:ref -> the original-language words (Greek NT and Hebrew OT) with Strong, morphology and lexicon (spec 8.10, 10.5).
import { getOriginalWords } from "@/lib/knowledge/original";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  if (!/^[A-Z0-9]{3}(\.\d+){1,2}(-[A-Z0-9]{3}(\.\d+){1,2})?$/.test(ref)) return Response.json({ error: "invalid_ref" }, { status: 400 });
  const words = await getOriginalWords(ref).catch(() => null);
  if (!words) return Response.json({ error: "original_unavailable" }, { status: 503 });
  if (!words.length) return Response.json({ error: "not_found", note: "Referência sem texto original carregado." }, { status: 404 });
  return Response.json({ ref, source: "STEPBible TAGNT/TAHOT (Tyndale House), CC BY 4.0", words });
}
