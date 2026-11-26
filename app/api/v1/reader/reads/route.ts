// What the student has read (spec 8.24, RF-M24-02).
//   GET ?book=JHN        -> { refs: [...] }   the verses of that book already read
//   GET ?progress=1      -> { books: { JHN: 120, ... }, total }   verses read per book
//   POST {refs?, chapters?}    marks verses (and every verse of the chapters) as read
//   DELETE ?refs=a,b | ?chapter=JHN.3   unmarks
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { chapterVerseRefs } from "@/lib/reading/plans";
import { ReadsInput, chapterRef, verseRef } from "@/lib/reading/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const p = new URL(req.url).searchParams;
    if (p.get("progress")) {
      const { data, error } = await db.rpc("reader_progress");
      if (error) throw new HttpError(500, "load_failed");
      const books: Record<string, number> = {};
      for (const r of (data ?? []) as { book_code: string; n: number | string }[]) books[r.book_code] = Number(r.n);
      return Response.json({ books, total: Object.values(books).reduce((a, b) => a + b, 0) });
    }
    const book = p.get("book") ?? "";
    if (!/^[0-9A-Z]{3}$/.test(book)) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.from("bible_reads").select("ref").eq("user_id", user.id).eq("book_code", book).limit(3000);
    if (error) throw new HttpError(500, "load_failed");
    return Response.json({ refs: (data ?? []).map((r) => r.ref as string) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = ReadsInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const refs = [...new Set([...(parsed.data.refs ?? []), ...(parsed.data.chapters ?? []).flatMap(chapterVerseRefs)])];
    if (!refs.length) throw new HttpError(400, "invalid_request");
    const now = new Date().toISOString();
    for (let i = 0; i < refs.length; i += 500) {
      const { error } = await db.from("bible_reads").upsert(refs.slice(i, i + 500).map((ref) => ({ user_id: user.id, ref, read_at: now })), { onConflict: "user_id,ref", ignoreDuplicates: true });
      if (error) throw new HttpError(500, "save_failed");
    }
    return Response.json({ ok: true, marked: refs.length }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const p = new URL(req.url).searchParams;
    const chapter = p.get("chapter");
    const refs = chapter ? (chapterRef.safeParse(chapter).success ? chapterVerseRefs(chapter) : []) : (p.get("refs") ?? "").split(",").filter((r) => verseRef.safeParse(r).success).slice(0, 400);
    if (!refs.length) throw new HttpError(400, "invalid_request");
    const { error } = await db.from("bible_reads").delete().eq("user_id", user.id).in("ref", refs);
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
