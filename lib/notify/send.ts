// The hourly sender (spec 8.15): reads the candidates, decides with chooseNotification, sends Web Push to each device, drops dead devices
// (404/410) and marks the day. Native push (APNs/FCM) arrives with the store apps (Prompt 2.5); tokens that are not Web Push are skipped here.
import webpush from "web-push";
import { chooseNotification, type Candidate, type Decision } from "./plan";
import { notificationText } from "./messages";

export interface Device { id: string; token: string; platform: string }
export interface Row extends Candidate { devices: Device[] }
export interface Deps {
  candidates(): Promise<Row[]>;
  mark(userId: string, kind: string): Promise<void>;
  dropDevice(id: string): Promise<void>;
  send(sub: unknown, payload: string): Promise<{ statusCode: number }>;
}
export interface TickResult { considered: number; sent: number; users: { user_id: string; kind: string; devices: number }[]; dropped: number; skipped_native: number }

export async function runTick(deps: Deps, now = new Date(), dry = false): Promise<TickResult> {
  const rows = await deps.candidates();
  const out: TickResult = { considered: rows.length, sent: 0, users: [], dropped: 0, skipped_native: 0 };
  for (const r of rows) {
    const d: Decision | null = chooseNotification(r, now);
    if (!d) continue;
    const text = notificationText(d, r.lang);
    const payload = JSON.stringify({ title: text.title, body: text.body, url: d.url, tag: d.kind });
    let ok = 0;
    for (const dev of r.devices) {
      if (dev.platform !== "web") { out.skipped_native++; continue; }
      let sub: unknown;
      try { sub = JSON.parse(dev.token); } catch { await deps.dropDevice(dev.id); out.dropped++; continue; }
      if (dry) { ok++; continue; }
      try { await deps.send(sub, payload); ok++; }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await deps.dropDevice(dev.id); out.dropped++; }
      }
    }
    if (ok > 0) {
      if (!dry) await deps.mark(r.user_id, d.kind);
      out.sent++; out.users.push({ user_id: r.user_id, kind: d.kind, devices: ok });
    }
  }
  return out;
}

/** The real sender, with the VAPID keys of the app. */
export function webPushSender(): Deps["send"] {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("vapid_not_configured");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://professor-filipe.vercel.app", pub, priv);
  return (sub, payload) => webpush.sendNotification(sub as webpush.PushSubscription, payload, { TTL: 6 * 3600, urgency: "low" });
}
