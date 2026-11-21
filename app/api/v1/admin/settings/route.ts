// GET /api/v1/admin/settings -> plans, sermon types and prompt versions. PUT {kind, ...} -> change one of them. Admin only; audited in the database.
import { z } from "zod";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const [plans, types, prompts] = await Promise.all([
      db.from("plans").select("id, name, price_month, price_year, limits, features, active").order("price_month"),
      db.from("sermon_types").select("id, name, definition, enabled, order").order("order"),
      db.rpc("api_admin_prompts"),
    ]);
    return Response.json({ plans: plans.data ?? [], sermonTypes: types.data ?? [], prompts: prompts.data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

const money = z.number().min(0).max(100000);
const num = z.number().int().min(0).max(100000).nullable();
const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), id: z.enum(["free", "plus", "premium"]), price_month: money, price_year: money.nullable(), active: z.boolean(),
    limits: z.object({ voice_minutes_day: num, text_messages_day: num, illustrations_day: num, lessons_month: num, deepen_month: num }), features: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])) }),
  z.object({ kind: z.literal("sermon_type"), id: z.string().uuid(), name: z.string().min(2).max(40), definition: z.string().min(10).max(600), enabled: z.boolean() }),
  z.object({ kind: z.literal("prompt_new"), layer: z.enum(["identity", "mode_free"]), content: z.string().min(40).max(12000) }),
  z.object({ kind: z.literal("prompt_activate"), layer: z.enum(["identity", "mode_free"]), version: z.number().int().min(1) }),
]);

export async function PUT(req: Request) {
  try {
    const { db } = await requireAdmin(req);
    const b = body.safeParse(await req.json().catch(() => null));
    if (!b.success) throw new HttpError(400, "invalid_request");
    const d = b.data;
    const r =
      d.kind === "plan" ? await db.rpc("api_admin_update_plan", { p_id: d.id, p_price_month: d.price_month, p_price_year: d.price_year, p_limits: d.limits, p_features: d.features, p_active: d.active })
      : d.kind === "sermon_type" ? await db.rpc("api_admin_update_sermon_type", { p_id: d.id, p_name: d.name, p_definition: d.definition, p_enabled: d.enabled })
      : d.kind === "prompt_new" ? await db.rpc("api_admin_new_prompt_version", { p_layer: d.layer, p_content: d.content })
      : await db.rpc("api_admin_activate_prompt", { p_layer: d.layer, p_version: d.version });
    if (r.error) throw new HttpError(400, "update_failed");
    return Response.json({ ok: true, version: d.kind === "prompt_new" ? r.data : undefined });
  } catch (e) {
    return errorResponse(e);
  }
}
