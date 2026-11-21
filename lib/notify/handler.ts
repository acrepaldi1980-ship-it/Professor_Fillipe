// Notification endpoints, served by the /api/v1/study/[...path] function:
//   GET  /study/notifications            -> my preferences, whether I have a device, the public key for Web Push
//   PUT  /study/notifications            -> { enabled?, hour?, kinds?, tz? }
//   POST /study/notifications/subscribe  -> { subscription (Web Push JSON), platform } registers this device
//   POST /study/notify-tick              -> hourly sender; only with the header x-cron-secret (the schedule lives in .github/workflows/notify.yml)
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/entitlements/server";
import { runTick, webPushSender, type Deps, type Row } from "./send";

const DEFAULTS = { enabled: false, hour: 19, tz: "America/Sao_Paulo", kinds: { review: true, path: true, lesson: true, trial: true }, lang: "pt-BR" };

export async function notificationsGet(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const [{ data: prefs }, { count }] = await Promise.all([
      db.from("notification_prefs").select("enabled, hour, tz, kinds, lang").eq("user_id", user.id).maybeSingle(),
      db.from("devices").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("push_token", "is", null),
    ]);
    return Response.json({ ...DEFAULTS, ...(prefs ?? {}), devices: count ?? 0, vapid_public_key: process.env.VAPID_PUBLIC_KEY ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}

const putBody = z.object({
  enabled: z.boolean().optional(), hour: z.number().int().min(7).max(21).optional(), tz: z.string().max(60).optional(), lang: z.enum(["pt-BR", "es"]).optional(),
  kinds: z.object({ review: z.boolean(), path: z.boolean(), lesson: z.boolean(), trial: z.boolean() }).partial().optional(),
});
export async function notificationsPut(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const p = putBody.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const { data: cur } = await db.from("notification_prefs").select("kinds").eq("user_id", user.id).maybeSingle();
    const row = { user_id: user.id, ...p.data, kinds: { ...DEFAULTS.kinds, ...(cur?.kinds ?? {}), ...(p.data.kinds ?? {}) }, updated_at: new Date().toISOString() };
    const { error } = await db.from("notification_prefs").upsert(row, { onConflict: "user_id" });
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

const subBody = z.object({ subscription: z.object({ endpoint: z.string().url().max(1000).startsWith("https://"), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }), platform: z.enum(["web", "ios", "android"]).default("web") });
export async function notificationsSubscribe(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const p = subBody.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "invalid_request");
    const token = JSON.stringify({ endpoint: p.data.subscription.endpoint, keys: p.data.subscription.keys });
    const { error } = await db.from("devices").upsert({ user_id: user.id, platform: p.data.platform, push_token: token, app_version: req.headers.get("x-app-version") ?? null, last_seen_at: new Date().toISOString() }, { onConflict: "user_id,push_token" });
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** `deps` lets the tests replace the real database and Web Push. */
export async function notifyTick(req: Request, deps?: Deps) {
  try {
    const want = process.env.CRON_SECRET ?? "";
    const got = req.headers.get("x-cron-secret") ?? "";
    if (!want || !same(got, want)) throw new HttpError(401, "unauthorized");
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const secret = process.env.BILLING_SERVER_SECRET ?? "";
    const db = serverDb();
    const real: Deps = deps ?? {
      candidates: async () => { const { data, error } = await db.rpc("api_notify_candidates", { p_secret: secret }); if (error) throw new HttpError(500, "candidates_failed"); return (data ?? []) as Row[]; },
      mark: async (u, k) => { await db.rpc("api_notify_mark", { p_secret: secret, p_user: u, p_kind: k }); },
      dropDevice: async (id) => { await db.rpc("api_notify_drop_device", { p_secret: secret, p_device: id }); },
      send: dry ? async () => ({ statusCode: 201 }) : webPushSender(),
    };
    // `at` (dry runs only, so nothing is ever sent for a made-up time) lets tests and the owner check what would go out at a given moment
    const at = dry ? new Date(new URL(req.url).searchParams.get("at") ?? "") : null;
    return Response.json(await runTick(real, at && !Number.isNaN(at.getTime()) ? at : new Date(), dry));
  } catch (e) {
    return errorResponse(e);
  }
}
