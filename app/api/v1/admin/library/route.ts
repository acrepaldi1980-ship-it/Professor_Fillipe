// GET /api/v1/admin/library -> totals of the knowledge base by tradition, kind and language, and the license review queue.
// Admin only. Works come from Supabase (all enabled, approved works); library chunks and the review queue from Neon.
import { createClient } from "@supabase/supabase-js";
import { errorResponse, requireAdmin } from "@/lib/auth/server";
import { refQuery } from "@/lib/knowledge/reference-db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: works } = await db.from("works").select("id,kind,tradition,language,license").limit(2000);
    const tally = (k: "kind" | "tradition" | "language" | "license") => {
      const m = new Map<string, number>();
      for (const w of works ?? []) m.set(w[k], (m.get(w[k]) ?? 0) + 1);
      return [...m].sort((a, b) => b[1] - a[1]).map(([name, works]) => ({ name, works }));
    };
    const libChunks = await refQuery<{ kind: string; tradition: string; n: number }>("select kind, tradition, count(*)::int n from chunks group by 1, 2 order by 3 desc");
    const review = await refQuery<{ id: string; title: string; authors: string; reason: string }>("select id, title, authors, reason from library_review order by id limit 200");
    const [{ total }] = await refQuery<{ total: number }>("select count(*)::int total from library_review");
    return Response.json({
      works: { total: works?.length ?? 0, byKind: tally("kind"), byTradition: tally("tradition"), byLanguage: tally("language"), byLicense: tally("license") },
      libraryChunks: libChunks,
      review: { total, items: review },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
