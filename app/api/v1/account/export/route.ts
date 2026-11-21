// GET /api/v1/account/export: everything the app holds about the signed-in student, as one JSON file (LGPD, RF-M02-04).
// Reads with the user's own token, so Row Level Security limits every table to their rows. Encrypted fields are decrypted for them.
import { errorResponse, requireUser } from "@/lib/auth/server";
import { decryptField, isEncrypted } from "@/lib/security/field-crypto";
import { enforceRate } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const TABLES = ["consent_records", "preferences", "sessions", "session_summaries", "session_closings", "notebook_items", "review_cards", "review_logs", "bookmarks", "lesson_plans", "sermon_outlines", "own_note_comments", "answer_flags", "subscriptions", "entitlements", "usage_counters"] as const;

const dec = (v: unknown) => {
  if (!isEncrypted(v as string)) return v ?? null;
  try {
    return decryptField(v as string);
  } catch {
    return null;
  }
};

export async function GET(req: Request) {
  try {
    const { db, user } = await requireUser(req);
    await enforceRate(db, `u:${user.id}:export`, { limit: 3, windowSeconds: 3600 });
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user: { id: user.id, email: user.email } };
    const prof = await db.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (prof.data) {
      const { ministry_role_enc, ...rest } = prof.data as Record<string, unknown>;
      out.profile = { ...rest, ministry_role: dec(ministry_role_enc) };
    }
    for (const t of TABLES) {
      const r = await db.from(t).select("*").limit(5000);
      let rows = (r.data ?? []) as Record<string, unknown>[];
      if (t === "preferences") rows = rows.map(({ lenses_enc, ...x }) => ({ ...x, lenses: dec(lenses_enc) }));
      out[t] = rows;
    }
    // conversation text: the student's own sessions
    const ids = ((out.sessions as { id: string }[]) ?? []).map((s) => s.id);
    const msgs = ids.length ? await db.from("messages").select("id, session_id, role, text, created_at").in("session_id", ids).order("created_at").limit(20000) : { data: [] };
    out.messages = msgs.data ?? [];
    return new Response(JSON.stringify(out, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="meus-dados-professor-filipe.json"', "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
