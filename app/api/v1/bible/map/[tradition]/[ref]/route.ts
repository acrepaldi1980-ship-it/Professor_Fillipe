// GET /api/v1/bible/map/:tradition/:ref -> the English-numbering reference of a verse of the Hebrew ("heb"), Latin ("lat")
// or Greek ("grc") tradition (STEPBible TVTMS, CC BY 4.0). Same reference when the numbering agrees.
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ tradition: string; ref: string }> }) {
  const { tradition, ref } = await ctx.params;
  if (!["heb", "lat", "grc"].includes(tradition) || !/^[A-Z0-9]{3}\.\d+\.\d+$/.test(ref)) return Response.json({ error: "invalid_ref" }, { status: 400 });
  try {
    const rows = await refQuery<{ eng_ref: string }>("select eng_ref from verse_map where tradition = $1 and ref = $2", [tradition, ref]);
    return Response.json({ tradition, ref, english: rows[0]?.eng_ref ?? ref, differs: rows.length > 0 });
  } catch {
    return Response.json({ error: "map_failed" }, { status: 503 });
  }
}
