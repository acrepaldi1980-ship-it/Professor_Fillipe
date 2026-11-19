// GET /api/v1/bible/crossrefs/:ref -> cross-references of a verse (Treasury of Scripture Knowledge, CC BY 4.0 dataset).
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  if (!/^[A-Z0-9]{3}\.\d+\.\d+$/.test(ref)) return Response.json({ error: "invalid_ref" }, { status: 400 });
  try {
    const rows = await refQuery<{ to_ref: string }>("select to_ref from cross_refs where from_ref = $1 order by to_ref limit 80", [ref]);
    return Response.json({ ref, source: "Treasury of Scripture Knowledge (CrossReferences.org, CC BY 4.0)", refs: rows.map((r) => r.to_ref) });
  } catch {
    return Response.json({ error: "crossrefs_failed" }, { status: 503 });
  }
}
