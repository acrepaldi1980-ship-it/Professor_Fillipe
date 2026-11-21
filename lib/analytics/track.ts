// Analytics events (spec 15.1), without sensitive data: the event name and a few short scalar props (never text typed by the student).
// Stored in analytics_events through api_track, which also drops long strings, so a mistake here cannot leak free text.
import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENTS = [
  "signup_completed", "consent_sensitive_granted", "interview_completed", "config_completed", "first_lesson_started", "session_started",
  "turn_completed", "visual_opened", "session_closed", "card_reviewed", "lesson_plan_exported", "sermon_outline_exported", "limit_reached",
  "checkout_started", "subscription_activated", "subscription_canceled", "answer_flagged",
] as const;
export type AnalyticsEvent = (typeof EVENTS)[number];
export type Props = Record<string, string | number | boolean>;

/** Fire and forget: tracking never slows down or breaks a request. */
export function track(db: SupabaseClient, event: AnalyticsEvent, props: Props = {}): void {
  void Promise.resolve(db.rpc("api_track", { p_event: event, p_props: props })).catch(() => undefined);
}
