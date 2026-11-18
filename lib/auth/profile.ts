// Profile and consent logic shared by the API routes (server only).
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptField, encryptField, isEncrypted } from "../security/field-crypto";
import { ageStatus } from "./age";
import { HttpError } from "./server";
import type { StudentProfile } from "../teacher/prompts";

export const TERMS_VERSION = "2026-11-18-rascunho";
export const CONSENT_KINDS = ["terms", "privacy", "sensitive_religious", "rehearsal_audio", "guardian_ack"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export interface ConsentState {
  granted: boolean;
  version: string;
}

/** Latest decision per consent kind. */
export async function loadConsents(db: SupabaseClient, userId: string): Promise<Record<string, ConsentState>> {
  const { data, error } = await db.from("consent_records").select("kind, version, granted, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw new HttpError(500, "consents_unavailable");
  const out: Record<string, ConsentState> = {};
  for (const r of data ?? []) out[r.kind] = { granted: r.granted, version: r.version };
  return out;
}

export async function recordConsent(db: SupabaseClient, userId: string, kind: ConsentKind, granted: boolean, version: string) {
  const { error } = await db.from("consent_records").insert({ user_id: userId, kind, version, granted, revoked_at: granted ? null : new Date().toISOString() });
  if (error) throw new HttpError(500, "consent_failed");
  // RF-M02-02: revoking the religious-data consent erases those fields.
  if (kind === "sensitive_religious" && !granted) {
    await db.from("profiles").update({ ministry_role_enc: null }).eq("user_id", userId);
    await db.from("preferences").update({ lenses_enc: null }).eq("user_id", userId);
  }
}

export interface ProfileInput {
  display_name?: string;
  preferred_name?: string;
  birth_date?: string;
  guardian_email?: string | null;
  timezone?: string;
  ui_prefs?: Record<string, unknown>;
}

/** Creates or updates the profile; enforces the age rules (RN-09, D-08). */
export async function saveProfile(db: SupabaseClient, userId: string, input: ProfileInput, guardianAck: boolean) {
  const patch: Record<string, unknown> = { user_id: userId };
  for (const k of ["display_name", "preferred_name", "guardian_email", "timezone", "ui_prefs"] as const) if (input[k] !== undefined) patch[k] = input[k];
  if (input.birth_date !== undefined) {
    const status = ageStatus(input.birth_date);
    if (status === "invalid") throw new HttpError(400, "invalid_birth_date");
    if (status === "too_young") throw new HttpError(403, "too_young");
    if (status === "minor_needs_guardian" && !guardianAck) throw new HttpError(400, "guardian_ack_required");
    patch.birth_date = input.birth_date;
    patch.is_minor = status === "minor_needs_guardian";
  }
  const { error } = await db.from("profiles").upsert(patch, { onConflict: "user_id" });
  if (error) throw new HttpError(500, "profile_failed");
}

export async function loadProfile(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("display_name, preferred_name, birth_date, is_minor, guardian_email, timezone, locale, goals, level, level_score, preferred_formats, first_topic, ui_prefs, role, ministry_role_enc")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, "profile_unavailable");
  return data;
}

/** Student profile for the teacher prompt (spec 11.2). Religious fields only with consent. */
export async function studentForPrompt(db: SupabaseClient, userId: string): Promise<StudentProfile> {
  const p = await loadProfile(db, userId);
  let role: string | null = null;
  if (p?.ministry_role_enc && isEncrypted(p.ministry_role_enc)) {
    try {
      role = decryptField(p.ministry_role_enc);
    } catch {
      role = null;
    }
  }
  return {
    preferred_name: p?.preferred_name || p?.display_name || "amigo",
    level: (p?.level as StudentProfile["level"]) ?? "iniciante",
    goals: p?.goals ?? [],
    ministry_role: role,
    preferred_formats: p?.preferred_formats ?? [],
    is_minor: !!p?.is_minor,
    last_summaries: [],
  };
}

export const encryptSensitive = (v: string) => encryptField(v);
