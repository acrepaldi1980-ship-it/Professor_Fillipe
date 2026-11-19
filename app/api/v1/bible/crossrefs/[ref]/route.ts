// GET /api/v1/bible/crossrefs/:ref -> cross-references of a verse (Treasury of Scripture Knowledge, CC BY 4.0 dataset).
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  if (!/^[A-Z0-9]{3}\.\d+\.\d+$/.test(ref)) return Response.json({ error: "invalid_ref" }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json({ error: "not_configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("cross_refs").select("to_ref").eq("from_ref", ref).limit(80);
  if (error) return Response.json({ error: "crossrefs_failed" }, { status: 503 });
  return Response.json({ ref, source: "Treasury of Scripture Knowledge (CrossReferences.org, CC BY 4.0)", refs: (data ?? []).map((r) => r.to_ref) });
}
