// GET -> the session's document as an A4 PDF (lesson plan or sermon outline).
import { track } from "@/lib/analytics/track";
import { requireFeature } from "@/lib/entitlements/guard";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { deepPdf, lessonPdf, sermonPdf } from "@/lib/pdf/render";
import { DeepStudy, LessonPlan, SermonOutline } from "@/lib/modes/schema";
import { loadSessionMode } from "@/lib/modes/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, db } = await requireUser(req);
    await requireFeature(db, user.id, "pdf_export");
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
    } else if (sm.mode === "deep") {
      const { data } = await db.from("deep_studies").select("data").eq("session_id", id).maybeSingle();
      pdf = await deepPdf(DeepStudy.parse(data?.data ?? {}));
      name = "estudo-aprofundado.pdf";
    } else {
      throw new HttpError(400, "mode_has_no_document");
    }
    track(db, sm.mode === "lesson" ? "lesson_plan_exported" : "sermon_outline_exported");
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
