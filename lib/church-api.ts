// Shared by the /api/v1/church routes: maps the database function errors to clear HTTP answers.
import { HttpError } from "./auth/server";

export function rpcError(message: string | undefined): HttpError {
  const m = message ?? "";
  if (/forbidden|unauthorized/.test(m)) return new HttpError(403, "forbidden");
  if (/invalid_code/.test(m)) return new HttpError(404, "invalid_code");
  if (/church_full/.test(m)) return new HttpError(409, "church_full");
  if (/too_many_churches/.test(m)) return new HttpError(409, "too_many_churches");
  if (/admin_cannot_leave/.test(m)) return new HttpError(409, "admin_cannot_leave");
  if (/invalid_plan|teacher_not_in_church/.test(m)) return new HttpError(400, m.includes("plan") ? "invalid_plan" : "teacher_not_in_church");
  return new HttpError(400, "church_request_failed");
}
