// GET /api/v1/bible/study/interlinear/:ref -> original words of the verse(s) with morphology in Portuguese, grouped by verse (spec 8.7.4 P1).
import { getInterlinear } from "@/lib/knowledge/word-study";


export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  if (!/^[A-Z0-9]{3}(\.\d+){1,2}(-[A-Z0-9]{3}(\.\d+){1,2})?$/.test(ref)) return Response.json({ error: "invalid_ref" }, { status: 400 });
  const words = await getInterlinear(ref).catch(() => null);
  if (!words) return Response.json({ error: "interlinear_unavailable" }, { status: 503 });
  if (!words.length) return Response.json({ error: "not_found", note: "Referência sem texto original carregado." }, { status: 404 });
  const verses = [...new Set(words.map((w) => w.ref))].map((r) => ({ ref: r, words: words.filter((w) => w.ref === r) }));
  return Response.json({ ref, source: "STEPBible TAGNT/TAHOT (Tyndale House), CC BY 4.0. Morfologia decodificada pelo app.", verses });
}
