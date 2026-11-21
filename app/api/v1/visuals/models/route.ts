// GET /api/v1/visuals/models -> the 3D models of the catalog (built in code, see lib/visuals/models3d.ts).
import { MODELS_3D } from "@/lib/visuals/models3d";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ models: MODELS_3D.map((m) => ({ id: m.id, name: m.name, alt: m.alt })) }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
