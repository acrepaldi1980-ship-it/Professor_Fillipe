// Family tree of a person from the knowledge graph (parent_of, spouse_of, sibling_of): ancestors, descendants, siblings and the other parent of each child (partners),
// with the passage that gives each link. Generations are counted from the person: -1 parents, +1 children.
import { refQuery } from "@/lib/knowledge/reference-db";

export interface TreeNode { id: string; name: string; period: string | null; gen: number }
export interface TreeEdge { parent: string; child: string; refs: string[] }
export interface FamilyTree { focus: string; nodes: TreeNode[]; edges: TreeEdge[]; partners: { a: string; b: string; refs: string[] }[]; siblings: { id: string; refs: string[] }[]; truncated: boolean }

const MAX_UP = 14, MAX_DOWN = 5, MAX_NODES = 140;
const arr = (a: string[]) => `{${a.map((x) => `"${x.replace(/"/g, "")}"`).join(",")}}`;

export async function familyTree(focus: string): Promise<FamilyTree> {
  type Rel = { from_id: string; to_id: string; refs: string[] | null };
  const up = await refQuery<{ id: string; d: number }>(
    `with recursive up(id, d) as (select $1::text, 0 union select r.from_id, up.d + 1 from kg_relations r join up on r.to_id = up.id where r.relation = 'parent_of' and up.d < ${MAX_UP}) select id, min(d)::int as d from up group by id`, [focus]);
  const down = await refQuery<{ id: string; d: number }>(
    `with recursive dn(id, d) as (select $1::text, 0 union select r.to_id, dn.d + 1 from kg_relations r join dn on r.from_id = dn.id where r.relation = 'parent_of' and dn.d < ${MAX_DOWN}) select id, min(d)::int as d from dn group by id`, [focus]);
  const gen = new Map<string, number>();
  for (const u of up) gen.set(u.id, -u.d);
  for (const d of down) if (!gen.has(d.id)) gen.set(d.id, d.d);
  let ids = [...gen.keys()];
  let truncated = false;
  if (ids.length > MAX_NODES) { ids = ids.sort((a, b) => Math.abs(gen.get(a)!) - Math.abs(gen.get(b)!)).slice(0, MAX_NODES); truncated = true; }
  const set = new Set(ids);

  // siblings of the person (declared, or sharing a parent) and the other parent of every child shown
  const sibRows = await refQuery<Rel>("select from_id, to_id, refs from kg_relations where relation = 'sibling_of' and (from_id = $1 or to_id = $1)", [focus]);
  const siblings = new Map<string, string[]>();
  for (const r of sibRows) { const o = r.from_id === focus ? r.to_id : r.from_id; if (o !== focus) siblings.set(o, r.refs ?? []); }
  const parentsOfFocus = [...set].filter((i) => gen.get(i) === -1);
  if (parentsOfFocus.length) {
    const shared = await refQuery<Rel>("select from_id, to_id, refs from kg_relations where relation = 'parent_of' and from_id = any($1::text[]) and to_id <> $2", [arr(parentsOfFocus), focus]);
    for (const r of shared) if (!siblings.has(r.to_id)) siblings.set(r.to_id, r.refs ?? []);
  }
  for (const s of siblings.keys()) { if (!set.has(s) && set.size < MAX_NODES + 30) { set.add(s); gen.set(s, 0); } }

  const edgeRows = set.size ? await refQuery<Rel>("select from_id, to_id, refs from kg_relations where relation = 'parent_of' and to_id = any($1::text[]) and from_id <> to_id", [arr([...set])]) : [];
  // partners: the other parent of a child that is in the tree
  for (const r of edgeRows) if (!set.has(r.from_id)) { set.add(r.from_id); gen.set(r.from_id, (gen.get(r.to_id) ?? 0) - 1); }
  const spouseRows = await refQuery<Rel>("select from_id, to_id, refs from kg_relations where relation = 'spouse_of' and (from_id = any($1::text[]) or to_id = any($1::text[]))", [arr([...set])]);
  for (const r of spouseRows) {
    if (set.has(r.from_id) && !set.has(r.to_id)) { set.add(r.to_id); gen.set(r.to_id, gen.get(r.from_id)!); }
    else if (set.has(r.to_id) && !set.has(r.from_id)) { set.add(r.from_id); gen.set(r.from_id, gen.get(r.to_id)!); }
  }
  const all = [...set];
  const names = await refQuery<{ id: string; name_en: string; name_pt: string | null; period: string | null }>("select id, name_en, name_pt, period from kg_entities where id = any($1::text[])", [arr(all)]);
  const nodes: TreeNode[] = names.map((n) => ({ id: n.id, name: n.name_pt ?? n.name_en, period: n.period, gen: gen.get(n.id) ?? 0 }));
  const have = new Set(nodes.map((n) => n.id));
  const edges: TreeEdge[] = edgeRows.filter((r) => have.has(r.from_id) && have.has(r.to_id)).map((r) => ({ parent: r.from_id, child: r.to_id, refs: (r.refs ?? []).slice(0, 3) }));
  const partners: FamilyTree["partners"] = spouseRows.filter((r) => have.has(r.from_id) && have.has(r.to_id)).map((r) => ({ a: r.from_id, b: r.to_id, refs: (r.refs ?? []).slice(0, 3) }));
  // two parents of the same child are partners even when the graph has no spouse link
  const byChild = new Map<string, string[]>();
  for (const e of edges) (byChild.get(e.child) ?? byChild.set(e.child, []).get(e.child)!).push(e.parent);
  const pair = new Set(partners.map((p) => [p.a, p.b].sort().join("|")));
  for (const ps of byChild.values()) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const k = [ps[i], ps[j]].sort().join("|"); if (!pair.has(k)) { pair.add(k); partners.push({ a: ps[i], b: ps[j], refs: [] }); } }
  return { focus, nodes, edges, partners, siblings: [...siblings].filter(([id]) => have.has(id)).map(([id, refs]) => ({ id, refs: refs.slice(0, 3) })), truncated };
}
