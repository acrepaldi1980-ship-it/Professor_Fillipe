// GET -> the churches of the signed-in person (role, classes, codes only for who may see them). POST { name, plan, cnpj? } -> creates a church (the person becomes its administrator).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { rpcError } from "@/lib/church-api";

export const runtime = "nodejs";
const create = z.object({ name: z.string().trim().min(2).max(120), plan: z.enum(["church_30", "church_100", "church_300"]), cnpj: z.string().trim().max(24).optional() });

export async function GET(req: Request) {
  try {
    const { db } = await requireUser(req);
    const { data, error } = await db.rpc("api_church_my");
    if (error) throw rpcError(error.message);
    return Response.json({ churches: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = create.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.rpc("api_church_create", { p_name: p.data.name, p_plan: p.data.plan, p_cnpj: p.data.cnpj ?? null });
    if (error) throw rpcError(error.message);
    return Response.json({ id: data }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
