// GET -> the session's document as an A4 PDF (lesson plan or sermon outline).
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { lessonPdf, sermonPdf } from "@/lib/pdf/render";
import { LessonPlan, SermonOutline } from "@/lib/modes/schema";
import { loadSessionMode } from "@/lib/modes/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireUser(req);
    const { id } = await params;
    const sm = await loadSessionMode(db, id);
    if (!sm) throw new HttpError(404, "session_not_found");
    let pdf: Buffer;
    let name: string;
    if (sm.mode === "lesson") {
      const { data } = await db.from("lesson_plans").select("data").eq("session_id", id).maybeSingle();
      pdf = await lessonPdf(LessonPlan.parse(data?.data ?? {}), sm.context as { age_group?: string; minutes?: number; topic?: string });
      name = "plano-de-aula.pdf";
    } else if (sm.mode === "sermon") {
      const { data } = await db.from("sermon_outlines").select("data").eq("session_id", id).maybeSingle();
      pdf = await sermonPdf(SermonOutline.parse(data?.data ?? {}));
      name = "esboco-de-sermao.pdf";
    } else {
      throw new HttpError(400, "mode_has_no_document");
    }
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
