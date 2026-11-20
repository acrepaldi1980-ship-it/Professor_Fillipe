// GET /api/v1/notebook/export?id=n:<uuid>|all -> a PDF of one notebook item or of the whole notebook.
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { notebookPdf, type NotebookPdfItem } from "@/lib/pdf/render";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "all";
    const q = db.from("notebook_items").select("id, kind, title, content, created_at").order("created_at", { ascending: false }).limit(300);
    const m = /^n:([0-9a-f-]{36})$/.exec(id);
    const { data } = m ? await q.eq("id", m[1]) : await q;
    if (!data?.length) throw new HttpError(404, "not_found");
    const items: NotebookPdfItem[] = data.map((i) => {
      const c = (i.content ?? {}) as { summary?: string; text?: string; mind_map?: NotebookPdfItem["mindMap"] };
      return { kind: i.kind === "session" ? "Sessão" : i.kind === "note" ? "Nota" : i.kind, title: i.title, date: i.created_at, text: c.summary ?? c.text, mindMap: c.mind_map };
    });
    const pdf = await notebookPdf(m ? items[0].title : "Meu caderno de estudos", items);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${m ? "item-do-caderno" : "meu-caderno"}.pdf"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
