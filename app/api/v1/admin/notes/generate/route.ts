// POST /api/v1/admin/notes/generate {kind, book, title, passage, theme?} -> writes a draft note (admin only), with the
// originality report. Idempotent per (kind, book, ref range, title): a second call updates a note still in draft.
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";
import { createNotesDeps } from "@/lib/notes/deps";
import { generateNote } from "@/lib/notes/generate";
import { GenerateRequest } from "@/lib/notes/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin(req);
    const parsed = GenerateRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const deps = createNotesDeps();
    const note = await generateNote(parsed.data, deps);
    const row = {
      tradition: note.tradition,
      kind: note.kind,
      book_code: note.book_code,
      ref_range: note.ref_range,
      title: parsed.data.title,
      body: note.body,
      sources: note.sources,
      originality_report: note.originality_report,
      originality_score: note.originality_score,
      rewrite_count: note.rewrite_count,
      model: deps.llm.modelName,
      status: "draft",
    };
    const { data: existing } = await ctx.db.from("own_notes").select("id,status").eq("tradition", "pentecostal").eq("kind", row.kind).eq("book_code", row.book_code).eq("ref_range", row.ref_range).eq("title", row.title).maybeSingle();
    if (existing && existing.status !== "draft") return Response.json({ id: existing.id, skipped: "not_draft" });
    const res = existing ? await ctx.db.from("own_notes").update(row).eq("id", existing.id).select("id").single() : await ctx.db.from("own_notes").insert(row).select("id").single();
    if (res.error) throw new Error("db_error");
    return Response.json({ id: res.data.id, words: note.body.split(/\s+/).length, originality: note.originality_score, rewrites: note.rewrite_count });
  } catch (e) {
    return errorResponse(e);
  }
}
