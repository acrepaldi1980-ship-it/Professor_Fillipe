// Personalised path end to end: create from the profile, review days, privacy between students, progress, recompose on the weekly review, screen.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const made = [];
async function user(label) {
  const id = randomUUID(), email = `tp-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}',extensions.crypt('${pw}', extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1984-01-01',false,'iniciante',20)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',true)`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, email, pw, session: data.session, token: data.session.access_token };
  u.call = async (method, path, body) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return u;
}
const browser = await chromium.launch();
try {
  const a = await user("ana"), b = await user("beto");
  say("no personal path yet", (await a.call("GET", "/study/paths/meu")).status === 404);
  say("invalid request is 400", (await a.call("POST", "/study/paths/personal", { goal: "x" })).status === 400);
  const mk = await a.call("POST", "/study/paths/personal", { goal: "know_jesus", role: "pastor", level: 1, minutes: 10, days: 30 });
  say("path created", mk.status === 201 && mk.body.total >= 28, JSON.stringify(mk.body));
  const det = await a.call("GET", "/study/paths/meu");
  say("detail has promise, weeks, adjust criterion and review days", !!det.body.promise && det.body.weeks.length >= 4 && !!det.body.adjust && det.body.days.filter((d) => d.kind === "review").length === 4);
  say("pastor gets the sermon outline each week", det.body.weeks.every((w) => w.extra === "sermon_outline"));
  say("it appears first in the list", (await a.call("GET", "/study/paths")).body.paths[0].id === "meu");
  say("another student does not see it", (await b.call("GET", "/study/paths/meu")).status === 404 && (await b.call("GET", "/study/paths")).body.paths.every((p) => p.id !== "meu"));
  for (let d = 1; d <= 7; d++) await a.call("POST", "/study/paths/day", { pathId: "meu", day: d });
  const s = await a.call("POST", "/sessions", { mode: "free", pathId: "meu", pathDay: 1 });
  say("a session for a day of the personal path opens", s.status === 201);
  const rv = await a.call("POST", "/study/paths/personal", { goal: "overcome", role: "pastor", level: 1, minutes: 10, days: 30 });
  const det2 = await a.call("GET", "/study/paths/meu");
  say("weekly review recomposes and keeps the 7 days done", rv.body.version === 2 && det2.body.done === 7 && det2.body.days.slice(0, 7).every((d, i) => d.ref === det.body.days[i].ref && d.done));
  // screen
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "pt-BR" }); const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const mkput = (p) => (sess) => p.evaluate(async ({ key: k, value }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(sess) });
  await page.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await mkput(page)(a.session);
  await page.goto(`${BASE}/trilhas?id=meu`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=path-review]", { timeout: 20000 }).catch(() => undefined);
  say("screen shows the review days and the week headings", (await page.locator("[data-testid=path-review]").count()) >= 4 && (await page.getByText(/Semana 1/).count()) > 0);
  say("screen shows the daily question and the remake button", (await page.getByText("Pergunta do dia").count()) > 0 && (await page.getByText("Refazer minha trilha").count()) > 0);
  const f = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "pt-BR" }); const p2 = await f.newPage();
  await p2.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await mkput(p2)(b.session);
  await p2.goto(`${BASE}/trilhas`, { waitUntil: "domcontentloaded" });
  await p2.waitForSelector("[data-testid=path-make]", { timeout: 20000 }).catch(() => undefined);
  await p2.click("[data-testid=path-make]");
  await p2.waitForSelector("[data-testid=path-form]");
  await p2.getByRole("button", { name: "Montar a trilha" }).click();
  await p2.waitForSelector("[data-testid=path-review]", { timeout: 20000 }).catch(() => undefined);
  say("a student can create the path from the form", (await p2.locator("[data-testid=path-review]").count()) >= 4);
  say("no page errors", errs.length === 0, errs.join("|"));
} finally {
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "ALL PASS" : "SOME FAILED"); process.exit(ok ? 0 : 1);
