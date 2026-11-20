// GET /api/v1/visuals/illustration/:hash -> the cached image bytes (the app fetches it with its token and shows it as a blob).
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const { db } = await requireUser(req);
    const { hash } = await params;
    if (!/^[0-9a-f]{32}$/.test(hash)) throw new HttpError(400, "invalid_hash");
    const { data } = await db.rpc("api_illustration_get", { p_hash: hash });
    const row = data?.[0] as { mime: string; image_b64: string } | undefined;
    if (!row) throw new HttpError(404, "not_found");
    return new Response(new Uint8Array(Buffer.from(row.image_b64, "base64")), { headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    return errorResponse(e);
  }
}
