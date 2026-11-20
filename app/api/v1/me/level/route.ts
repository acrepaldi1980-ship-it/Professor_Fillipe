// GET -> does the teacher have a level change to offer? (RF-M03-05: every 5 sessions, 3 of 5 signals.)
// POST {level} -> the student confirms or sets the level (only changes with confirmation).
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { suggestLevelChange, type Level, type LevelSignal } from "@/lib/onboarding/level";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const [{ data: p }, { data: sums, count }] = await Promise.all([
      db.from("profiles").select("level").eq("user_id", user.id).maybeSingle(),
      db.from("session_summaries").select("level_signal", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: true }),
    ]);
    const current = (p?.level as Level | undefined) ?? "iniciante";
    const signals = (sums ?? []).map((s) => (s.level_signal as LevelSignal | null) ?? "same");
    return Response.json({ level: current, suggestion: suggestLevelChange(signals, count ?? signals.length, current) });
  } catch (e) {
    return errorResponse(e);
  }
}

const body = z.object({ level: z.enum(["iniciante", "intermediário", "avançado"]) });

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const score = { iniciante: 20, intermediário: 50, avançado: 80 }[parsed.data.level];
    const { error } = await db.from("profiles").update({ level: parsed.data.level, level_score: score }).eq("user_id", user.id);
    if (error) throw new HttpError(500, "level_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
