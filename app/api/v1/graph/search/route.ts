// GET /api/v1/graph/search?q=Barnabas[&kind=person] -> entities of the knowledge graph by name (English or Portuguese).
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  const kind = u.searchParams.get("kind");
  if (q.length < 2) return Response.json({ error: "invalid_query" }, { status: 400 });
  if (kind && !["person", "place", "event", "group"].includes(kind)) return Response.json({ error: "invalid_kind" }, { status: 400 });
  try {
    const rows = await refQuery(
      `select id, kind, name_en, name_pt, period, refs[1:5] as refs, place_coords::text as coords
       from kg_entities
       where (lower(name_en) like lower($1) or lower(coalesce(name_pt,'')) like lower($1) or exists (select 1 from unnest(aliases) a where lower(a) like lower($1)))
         and ($2::text is null or kind = $2)
       order by (lower(name_en) = lower($3))::int desc, cardinality(refs) desc limit 20`,
      [`${q}%`, kind, q],
    );
    return Response.json({ q, results: rows });
  } catch {
    return Response.json({ error: "graph_failed" }, { status: 503 });
  }
}
