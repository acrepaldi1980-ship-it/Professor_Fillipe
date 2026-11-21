// GET /api/v1/bible/compare?ref=ACT.8.30&versions=a,b,c -> the verse(s) in each version side by side, with the words that differ from the first version marked.
import { diffWords } from "@/lib/knowledge/diff";
import { getVerses } from "@/lib/knowledge/search";


export async function GET(req: Request) {
  const u = new URL(req.url);
  const ref = u.searchParams.get("ref") ?? "";
  if (!/^[A-Z0-9]{3}(\.\d+){1,2}(-[A-Z0-9]{3}(\.\d+){1,2})?$/.test(ref)) return Response.json({ error: "invalid_ref" }, { status: 400 });
  const versions = (u.searchParams.get("versions") ?? "por_blivre_2018,por_nbv_open").split(",").filter((v) => /^[a-z]{3}_[a-z0-9_]+$/.test(v)).slice(0, 4);
  if (versions.length < 2) return Response.json({ error: "choose_two_versions" }, { status: 400 });
  const per = await Promise.all(versions.map(async (v) => ({ v, rows: await getVerses(v, [ref]).catch(() => []) })));
  const base = per[0].rows;
  const verses = base.map((b) => ({
    ref: b.ref,
    base: { version: versions[0], text: b.text },
    others: per.slice(1).map((p) => { const r = p.rows.find((x) => x.ref === b.ref); return { version: p.v, text: r?.text ?? null, segments: r ? diffWords(b.text, r.text) : null }; }),
  }));
  if (!verses.length) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ref, versions, verses });
}
