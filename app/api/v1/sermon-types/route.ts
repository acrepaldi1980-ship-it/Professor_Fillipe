// GET -> the sermon types available (table sermon_types, spec 8.7.3).
import { anonClient, errorResponse } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data } = await anonClient().from("sermon_types").select("name, definition").eq("enabled", true).order("order");
    return Response.json({ types: data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
