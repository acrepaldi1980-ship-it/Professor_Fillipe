// POST /api/v1/me/interview { answers } -> saves the guided-interview answers, estimates the level (RF-M03-02) and returns it.
// The ministry role is religious data: it is only stored (encrypted) with the sensitive_religious consent.
import { z } from "zod";
import { encryptSensitive, loadConsents } from "@/lib/auth/profile";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { computeLevel } from "@/lib/onboarding/level";

export const runtime = "nodejs";

const body = z.object({
  preferred_name: z.string().trim().min(1).max(40),
  study_experience: z.enum(["starting", "lt_2y", "2_10y", "gt_10y"]),
  goals: z.array(z.enum(["understand", "teach", "preach", "academic"])).max(4),
  ministry_role: z.enum(["none", "ebd_teacher", "preacher", "pastor", "leader", "student_theology", "other"]).optional(),
  teaching_age_group: z.enum(["kids", "teens", "youth", "adults", "mixed"]).optional(),
  daily_minutes: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30), z.literal(60)]),
  preferred_formats: z.array(z.enum(["audio", "text", "visual"])).max(3),
  first_topic: z.string().trim().min(2).max(200),
});

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const a = parsed.data;
    const consents = await loadConsents(db, user.id);
    const religious = !!consents.sensitive_religious?.granted;
    const role = religious ? a.ministry_role ?? "none" : "none";
    const { score, level } = computeLevel({ experience: a.study_experience, role, openAnswers: [a.first_topic] });
    const patch = {
      user_id: user.id,
      preferred_name: a.preferred_name,
      study_experience: a.study_experience,
      goals: a.goals,
      ministry_role_enc: religious && a.ministry_role ? encryptSensitive(a.ministry_role) : null,
      teaching_age_group: religious && role === "ebd_teacher" ? a.teaching_age_group ?? null : null,
      daily_minutes: a.daily_minutes,
      preferred_formats: a.preferred_formats,
      first_topic: a.first_topic,
      level_score: score,
      level,
    };
    const { error } = await db.from("profiles").upsert(patch, { onConflict: "user_id" });
    if (error) throw new HttpError(500, "interview_failed");
    return Response.json({ score, level });
  } catch (e) {
    return errorResponse(e);
  }
}
