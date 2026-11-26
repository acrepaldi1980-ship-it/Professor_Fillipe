// Notes on verses (spec 8.24, RF-M24-06).
//   GET ?book=&chapter=&ref=&context=&tag=&from=&to=&q=&order=date|bible  -> { notes, contexts, books }
//   POST {version_id, ref_start, ref_end?, text, context?, tags?, color?}    PATCH {id, ...}    DELETE ?id=
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { NoteInput, NotePatch } from "@/lib/reading/schema";

export const runtime = "nodejs";
const COLS = "id, version_id, ref_start, ref_end, book_code, chapter, text, context, tags, color, created_at, updated_at";
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const p = new URL(req.url).searchParams;
    let q = db.from("verse_notes").select(COLS).eq("user_id", user.id);
    const book = p.get("book"); if (book && /^[0-9A-Z]{3}$/.test(book)) q = q.eq("book_code", book);
    const chapter = Number(p.get("chapter")); if (book && chapter > 0) q = q.eq("chapter", chapter);
    const context = p.get("context"); if (context) q = q.eq("context", context.slice(0, 40));
    const tag = p.get("tag"); if (tag) q = q.contains("tags", [tag.slice(0, 30)]);
    const from = p.get("from"), to = p.get("to");
    if (from && /^\d{4}-\d{2}-\d{2}/.test(from)) q = q.gte("created_at", `${from.slice(0, 10)}T00:00:00Z`);
    if (to && /^\d{4}-\d{2}-\d{2}/.test(to)) q = q.lte("created_at", `${to.slice(0, 10)}T23:59:59Z`);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
    if (error) throw new HttpError(500, "load_failed");
    let notes = data ?? [];
    const ref = p.get("ref");
    if (ref && /^[0-9A-Z]{3}\.\d+\.\d+$/.test(ref)) {
      const [b, c, v] = ref.split("."); const n = Number(v);
      notes = notes.filter((x) => { const [b1, c1, v1] = (x.ref_start as string).split("."), [, c2, v2] = (x.ref_end as string).split("."); return b1 === b && c1 === c && Number(v1) <= n && (c2 !== c || Number(v2) >= n); });
    }
    const text = p.get("q"); if (text?.trim()) { const words = fold(text).split(/\s+/).filter(Boolean); notes = notes.filter((x) => { const hay = fold(`${x.text} ${x.context ?? ""} ${(x.tags as string[]).join(" ")}`); return words.every((w) => hay.includes(w)); }); }
    if (p.get("order") === "bible") notes = [...notes].sort((a, b) => a.book_code === b.book_code ? (a.chapter - b.chapter) || (Number((a.ref_start as string).split(".")[2]) - Number((b.ref_start as string).split(".")[2])) : 0);
    // the filters offered to the student: contexts and books that have notes
    const { data: all } = await db.from("verse_notes").select("context, book_code, tags").eq("user_id", user.id).limit(2000);
    const contexts = [...new Set((all ?? []).map((x) => x.context as string | null).filter((x): x is string => !!x))].sort();
    const tags = [...new Set((all ?? []).flatMap((x) => x.tags as string[]))].sort();
    const books: Record<string, number> = {}; for (const x of all ?? []) books[x.book_code as string] = (books[x.book_code as string] ?? 0) + 1;
    return Response.json({ notes, contexts, tags, books });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = NoteInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const d = parsed.data;
    if (d.ref_end && d.ref_end.slice(0, 3) !== d.ref_start.slice(0, 3)) throw new HttpError(400, "invalid_range");
    const { data, error } = await db.from("verse_notes").insert({ user_id: user.id, version_id: d.version_id, ref_start: d.ref_start, ref_end: d.ref_end ?? d.ref_start, text: d.text, context: d.context || null, tags: d.tags ?? [], color: d.color ?? null }).select(COLS).single();
    if (error || !data) throw new HttpError(500, "save_failed");
    return Response.json({ note: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = NotePatch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { id, ...d } = parsed.data;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (d.text !== undefined) patch.text = d.text;
    if (d.context !== undefined) patch.context = d.context || null;
    if (d.tags !== undefined) patch.tags = d.tags;
    if (d.color !== undefined) patch.color = d.color;
    const { data, error } = await db.from("verse_notes").update(patch).eq("id", id).eq("user_id", user.id).select(COLS).maybeSingle();
    if (error) throw new HttpError(500, "save_failed");
    if (!data) throw new HttpError(404, "not_found");
    return Response.json({ note: data });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "invalid_request");
    await db.from("verse_notes").delete().eq("id", id).eq("user_id", user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
