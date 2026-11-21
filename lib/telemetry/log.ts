// Structured logs and error reporting (spec 12/RNF). Never receives conversation text: only route, short code, status, latency.
// - one JSON line per event on stdout (Vercel keeps it searchable);
// - errors are counted per route/hour in app_errors (admin dashboard + alerts);
// - if SENTRY_DSN is set, the error is also sent to Sentry through its envelope endpoint (no SDK needed).
import { createClient } from "@supabase/supabase-js";

export function logEvent(evt: string, fields: Record<string, string | number | boolean | null> = {}) {
  console.log(JSON.stringify({ evt, t: new Date().toISOString(), ...fields }));
}

function sentryTarget(): { url: string; auth: string } | null {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\//, "");
    return { url: `${u.protocol}//${u.host}/api/${project}/envelope/`, auth: `Sentry sentry_version=7, sentry_key=${u.username}, sentry_client=pf/1` };
  } catch {
    return null;
  }
}

/** Records a server failure. Fire and forget: never throws and never delays the response. */
export function reportError(route: string, code: string, status = 500) {
  logEvent("api_error", { route, code: code.slice(0, 80), status });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    void createClient(url, key, { auth: { persistSession: false } })
      .rpc("api_log_error", { p_route: route, p_code: code })
      .then(() => undefined, () => undefined);
  }
  const s = sentryTarget();
  if (s) {
    const id = crypto.randomUUID().replace(/-/g, "");
    const event = { event_id: id, timestamp: Date.now() / 1000, level: "error", platform: "node", message: `${route}: ${code}`, tags: { route, code, status: String(status) }, environment: process.env.VERCEL_ENV ?? "local" };
    const body = [JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
    void fetch(s.url, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": s.auth }, body }).then(() => undefined, () => undefined);
  }
}
