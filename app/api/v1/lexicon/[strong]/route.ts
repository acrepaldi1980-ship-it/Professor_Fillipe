// GET /api/v1/lexicon/:strong -> lexicon entries of a Strong number: Greek brief (TBESG) and full (TFLSJ) from STEPBible, CC BY 4.0.
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ strong: string }> }) {
  const { strong } = await ctx.params;
  if (!/^G\d{4,5}$/.test(strong)) return Response.json({ error: "invalid_strong", note: "Só o léxico grego está carregado (G0001 a G5624...)." }, { status: 400 });
  try {
    const rows = await refQuery<{ source: string; lemma: string | null; definition: string }>(
      "select source, lemma, definition from lexicon_entries where strong = $1 order by source, id limit 6",
      [strong],
    );
    if (!rows.length) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ strong, entries: rows });
  } catch {
    return Response.json({ error: "lexicon_failed" }, { status: 503 });
  }
}
