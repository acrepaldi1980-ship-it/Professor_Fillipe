// GET -> the lessons of the person's classes (this week and the next days). POST { classId, title, ref?, date?, notes? } -> publishes a lesson (class teacher).
// DELETE ?id= -> removes a lesson (class teacher).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";

export const runtime = "nodejs";
const body = z.object({ classId: z.string().uuid(), title: z.string().trim().min(2).max(160), ref: z.string().trim().max(80).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes: z.string().trim().max(2000).optional() });

export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    // ?classId= -> the teacher's own list for that class; without it, the lessons of the person's own classes (home card)
    const classId = new URL(req.url).searchParams.get("classId");
    if (classId) {
      if (!/^[0-9a-f-]{36}$/.test(classId)) throw new HttpError(400, "invalid_request");
      const { data, error } = await db.rpc("api_class_lessons", { p_class: classId });
      if (error) throw rpcError(error.message);
      return Response.json({ lessons: data ?? [] });
    }
    const { data, error } = await db.rpc("api_lessons_for_me");
    if (error) throw rpcError(error.message);
    return Response.json({ lessons: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.rpc("api_lesson_publish", { p_class: p.data.classId, p_title: p.data.title, p_ref: p.data.ref ?? null, p_date: p.data.date ?? null, p_notes: p.data.notes ?? null });
    if (error) throw rpcError(error.message);
    return Response.json({ id: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "invalid_request");
    const { error } = await db.rpc("api_lesson_delete", { p_lesson: id });
    if (error) throw rpcError(error.message);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
