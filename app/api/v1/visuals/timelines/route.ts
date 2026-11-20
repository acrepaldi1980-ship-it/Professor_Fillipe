// GET /api/v1/visuals/timelines?id=jesus_life -> a timeline (events with approximate dates), or the list without id.
import { anonClient, errorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const db = anonClient();
    if (!id) {
      const { data } = await db.from("timelines").select("id, name").order("name");
      return Response.json({ timelines: data ?? [] });
    }
    const { data } = await db.from("timelines").select("id, name, events").eq("id", id).maybeSingle();
    if (!data) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ timeline: data }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return errorResponse(e);
  }
}
