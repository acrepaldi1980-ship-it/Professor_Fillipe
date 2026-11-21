// GET ?classId=&lessonId= -> the teacher panel: AGGREGATES ONLY, hidden below 5 students (privacy rule of spec 8.13). Never returns a message.
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";

export const runtime = "nodejs";
const uuid = /^[0-9a-f-]{36}$/;

export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    const u = new URL(req.url);
    const classId = u.searchParams.get("classId") ?? "";
    const lessonId = u.searchParams.get("lessonId");
    if (!uuid.test(classId) || (lessonId && !uuid.test(lessonId))) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.rpc("api_class_stats", { p_class: classId, p_lesson: lessonId });
    if (error) throw rpcError(error.message);
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
