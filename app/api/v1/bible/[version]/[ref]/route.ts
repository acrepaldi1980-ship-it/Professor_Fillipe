// GET /api/v1/bible/:version/:ref -> verses (spec 10.5). :ref is a canonical ref ("JHN.3.16", "ACT.8.26-ACT.8.40", "PSA.23").
import { getVerses } from "@/lib/knowledge/search";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ version: string; ref: string }> }) {
  const { version, ref } = await ctx.params;
  if (!/^[a-z0-9_]+$/i.test(version) || !/^[A-Z0-9]{3}(\.\d+){1,2}(-[A-Z0-9]{3}(\.\d+){1,2})?$/.test(ref)) {
    return Response.json({ error: "invalid_ref" }, { status: 400 });
  }
  const verses = await getVerses(version, [ref]);
  if (!verses.length) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ version, ref, verses });
}
