// POST {title, text, book?} -> a personal note; DELETE ?id=n:<uuid> -> removes one of the student's own items.
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";
const body = z.object({ title: z.string().trim().min(1).max(120), text: z.string().trim().max(5000).default(""), book: z.string().regex(/^[0-9A-Z]{3}$/).optional() });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { data, error } = await db.from("notebook_items").insert({ user_id: user.id, kind: "note", title: parsed.data.title, content: { text: parsed.data.text }, book_codes: parsed.data.book ? [parsed.data.book] : [] }).select("id").single();
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ id: `n:${data.id}` }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const m = /^n:([0-9a-f-]{36})$/.exec(id);
    if (!m) throw new HttpError(400, "invalid_id");
    await db.from("notebook_items").delete().eq("id", m[1]);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
