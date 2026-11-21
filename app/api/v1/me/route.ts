// GET /api/v1/me: profile + consent state. PUT /api/v1/me: create/update the profile (age rules enforced, RN-09).
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { errorResponse, requireUser } from "@/lib/auth/server";
import { loadConsents, loadProfile, saveProfile, TERMS_VERSION } from "@/lib/auth/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const [profile, consents] = await Promise.all([loadProfile(db, user.id), loadConsents(db, user.id)]);
    const { ministry_role_enc: _enc, ...safe } = profile ?? ({} as NonNullable<typeof profile>);
    void _enc;
    const needsConsent = !consents.terms?.granted || !consents.privacy?.granted || !profile?.birth_date || (profile?.is_minor && !consents.guardian_ack?.granted);
    return Response.json({
      user: { id: user.id, email: user.email },
      profile: profile ? safe : null,
      consents,
      termsVersion: TERMS_VERSION,
      onboarding: { needsConsent: !!needsConsent, needsReligiousChoice: !consents.sensitive_religious, needsInterview: !profile?.level },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

const putBody = z.object({
  display_name: z.string().trim().min(1).max(80).optional(),
  preferred_name: z.string().trim().min(1).max(40).optional(),
  birth_date: z.string().optional(),
  guardian_ack: z.boolean().optional(),
  guardian_email: z.string().email().nullable().optional(),
  timezone: z.string().max(64).optional(),
  locale: z.enum(["pt-BR", "es"]).optional(),
  ui_prefs: z.record(z.string(), z.unknown()).optional(),
});

export async function PUT(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = putBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
    const { guardian_ack, ...input } = parsed.data;
    const consents = await loadConsents(db, user.id);
    const existed = !!(await loadProfile(db, user.id))?.birth_date;
    await saveProfile(db, user.id, input, guardian_ack === true || !!consents.guardian_ack?.granted);
    if (!existed && input.birth_date) track(db, "signup_completed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
