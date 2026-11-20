// GET /api/v1/visuals/maps?id=exodus -> a map route (steps with coordinates, verses, notes, sources), or the list without id.
import { anonClient, errorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const db = anonClient();
    if (!id) {
      const { data } = await db.from("map_routes").select("id, name, era").order("name");
      return Response.json({ routes: data ?? [] });
    }
    const { data } = await db.from("map_routes").select("id, name, era, steps, sources").eq("id", id).maybeSingle();
    if (!data) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ route: data }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return errorResponse(e);
  }
}
