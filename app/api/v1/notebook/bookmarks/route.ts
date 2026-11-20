// POST {ref, version_id, note?} -> marks a verse; DELETE ?ref=&version= -> unmarks it.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";
const body = z.object({ ref: z.string().regex(/^[0-9A-Z]{3}\.\d+(\.\d+)?$/), version_id: z.string().max(60), note: z.string().max(500).optional() });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { error } = await db.from("bookmarks").upsert({ user_id: user.id, ...parsed.data, note: parsed.data.note ?? null }, { onConflict: "user_id,ref,version_id" });
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await requireUser(req);
    const p = new URL(req.url).searchParams;
    await db.from("bookmarks").delete().eq("ref", p.get("ref") ?? "").eq("version_id", p.get("version") ?? "");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
