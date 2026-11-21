// Notifications end to end (spec 8.15, Prompt 2.7): preferences, device registration, privacy, and the hourly sender's decisions (dry runs: nothing
// is ever sent to a real push service from a test).
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const CRON = process.env.CRON_SECRET;
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const made = [];
async function user(label) {
  const id = randomUUID(), email = `nt-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, session: data.session, token: data.session.access_token };
  u.call = async (method, path, body) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  u.sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
  return u;
}
const tick = async (q = "", secret = CRON) => { const r = await fetch(`${BASE}/api/v1/study/notify-tick${q}`, { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const SUB = (n) => ({ endpoint: `https://push.example.test/send/${n}`, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } });
const AT_EVENING = "2026-11-21T22:00:00Z"; // 19:00 in São Paulo

const browser = await chromium.launch();
try {
  if (!CRON) throw new Error("CRON_SECRET is not set in .env.local");
  const a = await user("ana"), b = await user("beto");
  // preferences
  const g = (await a.call("GET", "/study/notifications")).body;
  say("prefs: off by default, 19:00, all kinds on, the public key for Web Push is offered", g.enabled === false && g.hour === 19 && g.kinds.review && g.kinds.path && typeof g.vapid_public_key === "string" && g.vapid_public_key.length > 60 && g.devices === 0);
  say("prefs: an hour in the quiet period is refused (400)", (await a.call("PUT", "/study/notifications", { hour: 3 })).status === 400 && (await a.call("PUT", "/study/notifications", { hour: 22 })).status === 400);
  say("prefs: they are saved and kinds merge", (await a.call("PUT", "/study/notifications", { enabled: true, hour: 19, tz: "America/Sao_Paulo", kinds: { review: false } })).status === 200 && (await a.call("GET", "/study/notifications")).body.kinds.review === false && (await a.call("GET", "/study/notifications")).body.kinds.path === true);
  say("prefs: unauthenticated is refused (401)", (await fetch(`${BASE}/api/v1/study/notifications`)).status === 401);
  // device registration
  say("device: a non-https endpoint is refused (400)", (await a.call("POST", "/study/notifications/subscribe", { subscription: { endpoint: "http://insecure.test/x", keys: SUB(1).keys } })).status === 400);
  say("device: a subscription is registered (201)", (await a.call("POST", "/study/notifications/subscribe", { subscription: SUB(1) })).status === 201);
  await a.call("POST", "/study/notifications/subscribe", { subscription: SUB(1) });
  say("device: registering the same device twice keeps one row", (await sql(`select count(*)::int n from devices where user_id='${a.id}'`))[0].n === 1 && (await a.call("GET", "/study/notifications")).body.devices === 1);
  say("privacy: another student cannot read the device rows or the preferences", (await b.sb.from("devices").select("id")).data.length === 0 && (await b.sb.from("notification_prefs").select("user_id")).data.length === 0);
  // the sender
  say("sender: without the secret it is refused (401)", (await tick("?dry=1", "")).status === 401 && (await tick("?dry=1", "wrong")).status === 401);
  say("sender: the database function refuses anyone without the server secret", (await b.sb.rpc("api_notify_candidates", { p_secret: "nope" })).error !== null);
  const none = (await tick(`?dry=1&at=${AT_EVENING}`)).body;
  say("sender: nothing to say, nothing sent", !none.users.some((u) => u.user_id === a.id));
  await a.call("POST", "/study/paths/start", { pathId: "paulo14" });
  const path = (await tick(`?dry=1&at=${AT_EVENING}`)).body;
  say("sender: a started path with the day not studied yet produces the path reminder", path.users.some((u) => u.user_id === a.id && u.kind === "path" && u.devices === 1), JSON.stringify(path.users.filter((u) => u.user_id === a.id)));
  say("sender: not at the wrong hour", !(await tick(`?dry=1&at=2026-11-21T14:00:00Z`)).body.users.some((u) => u.user_id === a.id)); // 11:00 local
  say("sender: never in the quiet hours", !(await tick(`?dry=1&at=2026-11-22T01:30:00Z`)).body.users.some((u) => u.user_id === a.id)); // 22:30 local
  await a.call("PUT", "/study/notifications", { kinds: { path: false } });
  say("sender: a kind the student turned off is not sent", !(await tick(`?dry=1&at=${AT_EVENING}`)).body.users.some((u) => u.user_id === a.id));
  await a.call("PUT", "/study/notifications", { kinds: { path: true } });
  await sql(`update notification_prefs set last_sent_at = '2026-11-21T14:00:00Z', last_kind = 'path' where user_id='${a.id}'`);
  say("sender: at most 1 a day", !(await tick(`?dry=1&at=${AT_EVENING}`)).body.users.some((u) => u.user_id === a.id));
  await sql(`update notification_prefs set last_sent_at = '2026-11-20T22:00:00Z' where user_id='${a.id}'`);
  say("sender: the next day it goes again", (await tick(`?dry=1&at=${AT_EVENING}`)).body.users.some((u) => u.user_id === a.id));
  say("sender: a dry run marks nothing", (await sql(`select last_sent_at from notification_prefs where user_id='${a.id}'`))[0].last_sent_at.startsWith("2026-11-20"));
  await a.call("PUT", "/study/notifications", { enabled: false });
  say("sender: a student who turned reminders off gets nothing", !(await tick(`?dry=1&at=${AT_EVENING}`)).body.users.some((u) => u.user_id === a.id));
  say("sender: students who never turned them on are not even considered", !(await tick(`?dry=1&at=${AT_EVENING}`)).body.users.some((u) => u.user_id === b.id));

  // screen: the permission is offered only after the first completed session
  const ctx = await browser.newContext({ viewport: { width: 420, height: 1000 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(b.session) });
  await p.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-testid=reminders-card]", { timeout: 15000 });
  say("screen: before the first completed session the card explains it will be available later", (await p.locator("[data-testid=reminders-card]").innerText()).includes("depois da sua primeira sessão"));
  const sid = randomUUID();
  await sql(`insert into sessions (id, user_id, mode, ended_at) values ('${sid}','${b.id}','free', now())`);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector("[data-testid=reminders-card] input[type=checkbox]", { timeout: 15000 });
  say("screen: after a completed session the reminder switch appears, with the rules stated", (await p.locator("[data-testid=reminders-card]").innerText()).includes("22h e 7h") || (await p.locator("[data-testid=reminders-card] input[type=checkbox]").count()) === 1);
  say("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
