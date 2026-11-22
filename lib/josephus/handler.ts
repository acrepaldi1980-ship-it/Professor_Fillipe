// Josephus endpoints served by the /api/v1/study/[...path] function (Vercel Hobby allows 12 functions per deployment):
//   GET /study/josephus                         -> the biography, the four works and their 30 books, with chapters and counts
//   GET /study/josephus/:work/:book/:chapter    -> the numbered sections of one chapter (Whiston's translation) with the neighbors and the Bible parallels
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { refQuery } from "@/lib/knowledge/reference-db";
import { BIO, BOOKS, bookInfo, PARALLELS } from "./books";
import { cite, WORKS, type WorkKey } from "./structure";

type ChapterRow = { work: WorkKey; book: number; chapter: number; title: string; sections: number };
let tocCache: { at: number; rows: ChapterRow[] } | null = null;
async function toc(): Promise<ChapterRow[]> {
  if (tocCache && Date.now() - tocCache.at < 30 * 60 * 1000) return tocCache.rows;
  const rows = await refQuery<ChapterRow>(
    "select c.work, c.book, c.chapter, c.title, (select count(*)::int from josephus_sections s where s.work = c.work and s.book = c.book and s.chapter = c.chapter) as sections from josephus_chapters c order by c.work, c.book, c.chapter");
  tocCache = { at: Date.now(), rows };
  return rows;
}
const isWork = (w: string): w is WorkKey => w in WORKS;

export async function josephusGet(req: Request, work?: string, book?: string, chapter?: string) {
  try {
    await requireUser(req);
    const rows = await toc();
    if (!work) {
      const works = (Object.keys(WORKS) as WorkKey[]).map((w) => ({
        key: w, title: WORKS[w].title, cite: WORKS[w].cite,
        books: [
          ...(rows.some((r) => r.work === w && r.book === 0) ? [{ book: 0, title: "Prefácio", span: "", summary: "", key: [], chapters: rows.filter((r) => r.work === w && r.book === 0).map((r) => ({ chapter: r.chapter, title: r.title, sections: r.sections })) }] : []),
          ...BOOKS.filter((b) => b.work === w).map((b) => ({ book: b.book, title: b.title, span: b.span, summary: b.summary, key: b.key, chapters: rows.filter((r) => r.work === w && r.book === b.book).map((r) => ({ chapter: r.chapter, title: r.title, sections: r.sections })) })),
        ],
      }));
      return Response.json({ bio: BIO, works });
    }
    if (!isWork(work) || book === undefined || chapter === undefined) throw new HttpError(404, "not_found");
    const b = Number(book), c = Number(chapter);
    if (!Number.isInteger(b) || !Number.isInteger(c)) throw new HttpError(404, "not_found");
    const sections = await refQuery<{ n: number; text: string }>("select n, text from josephus_sections where work = $1 and book = $2 and chapter = $3 order by n", [work, b, c]);
    if (!sections.length) throw new HttpError(404, "not_found");
    const list = rows.filter((r) => r.work === work);
    const i = list.findIndex((r) => r.book === b && r.chapter === c);
    const ref = (r?: ChapterRow) => (r ? { work: r.work, book: r.book, chapter: r.chapter, label: cite(r.work, r.book, r.chapter, 1).replace(/\.1$/, "").replace(/ 1$/, "") } : null);
    const parallels = PARALLELS.filter((p) => p.work === work && p.book === b && p.chapter === c).map((p) => ({ n: p.n, cite: cite(work, b, c, p.n), refs: p.refs }));
    return Response.json({ work, book: b, chapter: c, title: list[i]?.title ?? "", info: bookInfo(work, b) ?? null, sections, prev: ref(list[i - 1]), next: ref(list[i + 1]), parallels, credit: "Texto de domínio público: Flávio Josefo, tradução inglesa de William Whiston (1737), via Project Gutenberg." });
  } catch (e) {
    return errorResponse(e);
  }
}
