// POST { churchId, name, ageGroup, teacherId? } -> creates a class (church administrator only).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";

export const runtime = "nodejs";
const body = z.object({ churchId: z.string().uuid(), name: z.string().trim().min(2).max(80), ageGroup: z.enum(["kids", "teens", "youth", "adults", "mixed"]).default("adults"), teacherId: z.string().uuid().optional() });

export async function POST(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.rpc("api_class_create", { p_church: p.data.churchId, p_name: p.data.name, p_age: p.data.ageGroup, p_teacher: p.data.teacherId ?? null });
    if (error) throw rpcError(error.message);
    return Response.json({ id: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
