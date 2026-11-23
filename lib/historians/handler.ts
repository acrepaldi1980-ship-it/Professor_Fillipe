// Reading endpoints for the historians' books, served by the /api/v1/study/[...path] function:
//   GET /study/historians                  -> the books available for reading, with counts
//   GET /study/historians/:work            -> the table of contents (units in order, grouped by part)
//   GET /study/historians/:work/:ord       -> one unit (a chapter, a letter or a block) with its neighbors
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { refQuery } from "@/lib/knowledge/reference-db";

const CACHE = { "Cache-Control": "private, max-age=300" };

export async function historiansGet(req: Request, work?: string, ord?: string) {
  try {
    await requireUser(req);
    if (!work) {
      const rows = await refQuery<{ id: string; author: string; title: string; edition: string; note: string; units: number; translated: number }>(
        "select w.id, w.author, w.title, w.edition, w.note, (select count(*)::int from hist_units u where u.work = w.id) as units, (select count(*)::int from hist_units u where u.work = w.id and u.text_pt is not null) as translated from hist_works w order by w.author, w.id");
      return Response.json({ works: rows }, { headers: CACHE });
    }
    if (!/^[a-z]{2,12}$/.test(work)) throw new HttpError(404, "not_found");
    if (ord === undefined) {
      const [w] = await refQuery<{ id: string; author: string; title: string; edition: string; note: string }>("select id, author, title, edition, note from hist_works where id = $1", [work]);
      if (!w) throw new HttpError(404, "not_found");
      const units = await refQuery<{ ord: number; part: string; label: string; title: string; title_pt: string | null; translated: boolean }>("select ord, part, label, title, title_pt, text_pt is not null as translated from hist_units where work = $1 order by ord", [work]);
      return Response.json({ work: w, units: units.map((u) => ({ ord: u.ord, part: u.part, label: u.label, title: u.title_pt ?? u.title, translated: u.translated })) }, { headers: CACHE });
    }
    const o = Number(ord);
    if (!Number.isInteger(o) || o < 1) throw new HttpError(404, "not_found");
    const [u] = await refQuery<{ ord: number; part: string; label: string; title: string; title_pt: string | null; text: string; text_pt: string | null }>("select ord, part, label, title, title_pt, text, text_pt from hist_units where work = $1 and ord = $2", [work, o]);
    if (!u) throw new HttpError(404, "not_found");
    const [w] = await refQuery<{ id: string; author: string; title: string; edition: string; note: string }>("select id, author, title, edition, note from hist_works where id = $1", [work]);
    const near = await refQuery<{ ord: number; label: string }>("select ord, label from hist_units where work = $1 and ord in ($2, $3)", [work, o - 1, o + 1]);
    return Response.json({ work: w, unit: { ...u, title: u.title_pt ?? u.title, titleEn: u.title }, prev: near.find((n) => n.ord === o - 1) ?? null, next: near.find((n) => n.ord === o + 1) ?? null }, { headers: CACHE });
  } catch (e) {
    return errorResponse(e);
  }
}
