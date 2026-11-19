// GET /api/v1/sources -> public list of the works in the knowledge base with license and credit (spec 8.10.9, 14.8).
// Generated from the `works` table; row-level security already hides works that are not enabled and approved.
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "not_configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db
    .from("works")
    .select("id,title,authors,pub_year,language,kind,tradition,license,credit_text,source_url")
    .order("kind")
    .order("title")
    .limit(500);
  if (error) return Response.json({ error: "sources_failed" }, { status: 503 });
  return Response.json({ works: data ?? [] });
}
