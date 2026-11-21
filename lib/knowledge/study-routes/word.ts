// GET /api/v1/bible/word/:strong?versions=a,b,c -> word study: lexicon entries, every occurrence count, the senses the data shows, and how the chosen
// versions render some of the verses where it appears (spec 8.7.4 P1). Versions are not aligned word by word, so verses are shown side by side.
import { getVerses } from "@/lib/knowledge/search";
import { getWordStudy } from "@/lib/knowledge/word-study";

const DEFAULT_VERSIONS = ["por_blivre_2018", "eng_kjv", "eng_bsb"];

export async function GET(req: Request, ctx: { params: Promise<{ strong: string }> }) {
  const { strong } = await ctx.params;
  if (!/^[GH]\d{1,4}[A-Za-z]?$/.test(strong)) return Response.json({ error: "invalid_strong" }, { status: 400 });
  const study = await getWordStudy(strong).catch(() => null);
  if (!study) return Response.json({ error: "not_found" }, { status: 404 });
  const versions = (new URL(req.url).searchParams.get("versions") ?? DEFAULT_VERSIONS.join(",")).split(",").filter((v) => /^[a-z]{3}_[a-z0-9_]+$/.test(v)).slice(0, 3);
  const refs = [...new Set(study.sample.map((s) => s.ref))].slice(0, 6);
  const byVersion: Record<string, Record<string, string>> = {};
  await Promise.all(versions.map(async (v) => { const rows = await getVerses(v, refs).catch(() => []); byVersion[v] = Object.fromEntries(rows.map((r) => [r.ref, r.text])); }));
  return Response.json({ ...study, versions, renderings: refs.map((ref) => ({ ref, texts: Object.fromEntries(versions.map((v) => [v, byVersion[v]?.[ref] ?? null])) })), source: "STEPBible (CC BY 4.0), LSJ (domínio público)" });
}
