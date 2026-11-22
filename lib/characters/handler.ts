// Characters endpoints served by the /api/v1/study/[...path] function (Vercel Hobby allows 12 functions per deployment):
//   GET /study/characters?q=&era=&page=   -> curated lives first, then every person of the knowledge graph (3,067), so nobody is left out
//   GET /study/characters/:id             -> a curated life (illustrated chapters) or an automatic card of the graph (id "kg:<graph id>")
import { errorResponse, requireUser } from "@/lib/auth/server";
import { refQuery } from "@/lib/knowledge/reference-db";
import { CURATED, curatedKgIds, getCurated, summarize, type CharacterSummary } from "./index";

const PAGE = 60;
const FIND_COLORS = ["#b9772f", "#6f7a3a", "#7d4a6e", "#3f6f86", "#8a4a3a", "#5a6f4a"];
const colorOf = (id: string) => FIND_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % FIND_COLORS.length];

type Row = { id: string; name_en: string; name_pt: string | null; period: string | null; n: number };

export async function charactersGet(req: Request, id?: string) {
  try {
    await requireUser(req);
    if (id) return await detail(decodeURIComponent(id));
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60).toLowerCase();
    const era = url.searchParams.get("era");
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) | 0);
    const curated = CURATED.map(summarize).filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!era || c.era === era));
    let rest: CharacterSummary[] = [];
    let total = curated.length;
    if (!era) {
      const known = [...curatedKgIds()];
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const rows = await refQuery<Row>(
        `select id, name_en, name_pt, period, coalesce(cardinality(refs), 0) as n from kg_entities
         where kind = 'person' and not (id = any($1::text[])) and ($2 = '%%' or lower(name_en) like $2 or lower(coalesce(name_pt, '')) like $2)
         order by n desc, name_en limit ${PAGE} offset ${page * PAGE}`, [`{${known.map((k) => `"${k}"`).join(",")}}`, like]);
      const [{ count }] = await refQuery<{ count: string }>(`select count(*) from kg_entities where kind = 'person' and not (id = any($1::text[])) and ($2 = '%%' or lower(name_en) like $2 or lower(coalesce(name_pt, '')) like $2)`, [`{${known.map((k) => `"${k}"`).join(",")}}`, like]);
      total += Number(count);
      rest = rows.map((r) => ({ id: `kg:${r.id.replace(/^person:/, "")}`, name: r.name_pt ?? r.name_en, title: r.period ? `viveu entre ${r.period.replace(" a ", " e ")}` : "", tier: 3 as const, era: null, color: colorOf(r.id), chapters: 0, period: r.period, born: null, died: null }));
    }
    return Response.json({ total, page, pageSize: PAGE, characters: page === 0 ? [...curated, ...rest] : rest });
  } catch (e) {
    return errorResponse(e);
  }
}

async function detail(id: string) {
  const cur = getCurated(id);
  if (cur) return Response.json({ kind: "curated", character: cur, graph: cur.kgId ? await graphOf(cur.kgId) : null });
  if (id.startsWith("kg:") && /^[\w.-]+$/.test(id.slice(3))) {
    const g = await graphOf(`person:${id.slice(3)}`);
    if (!g) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ kind: "card", id, color: colorOf(id), graph: g });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

async function graphOf(kgId: string) {
  const [e] = await refQuery<{ id: string; name_en: string; name_pt: string | null; aliases: string[] | null; description: string | null; period: string | null; refs: string[] | null }>(
    "select id, name_en, name_pt, aliases, description, period, refs from kg_entities where id = $1", [kgId]);
  if (!e) return null;
  const relations = await refQuery<{ relation: string; direction: string; id: string; kind: string; name_en: string; name_pt: string | null }>(
    `select r.relation, case when r.from_id = $1 then 'out' else 'in' end as direction, x.id, x.kind, x.name_en, x.name_pt
     from kg_relations r join kg_entities x on x.id = case when r.from_id = $1 then r.to_id else r.from_id end
     where r.from_id = $1 or r.to_id = $1 order by r.relation, x.name_en limit 80`, [kgId]);
  return { entity: e, relations };
}
