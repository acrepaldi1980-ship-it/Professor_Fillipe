// GET /api/v1/graph/entity/:id -> one entity with its relations and, for places, the people and events that share its verses.
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await ctx.params).id);
  if (!/^(person|place|event|group):[\w.-]+$/.test(id)) return Response.json({ error: "invalid_id" }, { status: 400 });
  try {
    const [entity] = await refQuery("select id, kind, name_en, name_pt, aliases, description, period, refs, place_coords::text as coords, source_ids from kg_entities where id = $1", [id]);
    if (!entity) return Response.json({ error: "not_found" }, { status: 404 });
    const relations = await refQuery(
      `select r.relation, case when r.from_id = $1 then 'out' else 'in' end as direction, e.id, e.kind, e.name_en, e.name_pt
       from kg_relations r join kg_entities e on e.id = case when r.from_id = $1 then r.to_id else r.from_id end
       where r.from_id = $1 or r.to_id = $1 order by r.relation, e.name_en limit 100`,
      [id],
    );
    // "Who was in Antioch?": people whose verses overlap the verses where the place is mentioned.
    const together =
      (entity as { kind: string }).kind === "place"
        ? await refQuery(`select p.id, p.name_en, p.name_pt from kg_entities p where p.kind = 'person' and p.refs && (select refs from kg_entities where id = $1) order by cardinality(p.refs) desc limit 30`, [id])
        : [];
    return Response.json({ entity, relations, mentionedWith: together });
  } catch {
    return Response.json({ error: "graph_failed" }, { status: 503 });
  }
}
