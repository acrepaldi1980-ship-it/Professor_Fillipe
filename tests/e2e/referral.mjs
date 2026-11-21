// Referral and share card end to end (Prompt 2.7): the code, the claim rules, the reward only after the friend studies on 2 days, the cap, privacy,
// and in the browser: the link is remembered and claimed, the account screen shows the code, and the share card is drawn on the device.
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
async function user(label, ageDays = 0) {
  const id = randomUUID(), email = `rf-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now() - interval '${ageDays} days', now(), '', '', '', '')`);
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
const studyDay = async (uid, daysAgo) => { const s = randomUUID(); await sql(`insert into sessions (id, user_id, mode) values ('${s}','${uid}','free')`); await sql(`insert into messages (session_id, role, text, created_at) values ('${s}','user','oi', now() - interval '${daysAgo} days')`); };
const premiumDays = async (uid) => (await sql(`select count(*)::int n from entitlements where user_id='${uid}' and source='referral' and status='active' and expires_at > now()`))[0].n;

const browser = await chromium.launch();
try {
  const a = await user("ana"), b = await user("beto"), old = await user("velho", 20), c = await user("carlos");
  const ra = (await a.call("GET", "/study/referral")).body;
  say("code: every student gets a code of letters and digits", /^[A-Z0-9]{7}$/.test(ra.code), ra.code);
  say("code: it is stable between calls", (await a.call("GET", "/study/referral")).body.code === ra.code);
  say("code: unauthenticated is refused (401)", (await fetch(`${BASE}/api/v1/study/referral`)).status === 401);
  // claim rules
  say("claim: your own code is refused", (await a.call("POST", "/study/referral/claim", { code: ra.code })).body.result === "own_code");
  say("claim: an unknown code is refused", (await b.call("POST", "/study/referral/claim", { code: "ZZZZZZZ" })).body.result === "invalid");
  say("claim: an old account cannot be referred", (await old.call("POST", "/study/referral/claim", { code: ra.code })).body.result === "too_late");
  say("claim: a malformed code is a 400", (await b.call("POST", "/study/referral/claim", { code: "a b!" })).status === 400);
  say("claim: a new student arriving by the code is recorded (201)", (await b.call("POST", "/study/referral/claim", { code: ra.code.toLowerCase() })).status === 201);
  say("claim: only once per student", (await b.call("POST", "/study/referral/claim", { code: ra.code })).body.result === "already_referred");
  // reward only after studying
  say("reward: nothing before the friend studies", (await b.call("GET", "/study/referral")).body.settled.settled === false && (await premiumDays(a.id)) === 0 && (await premiumDays(b.id)) === 0);
  await studyDay(b.id, 1);
  say("reward: one day of study is not enough", (await b.call("GET", "/study/referral")).body.settled.settled === false);
  await studyDay(b.id, 0);
  const done = (await b.call("GET", "/study/referral")).body;
  say("reward: after 2 different days both receive 7 days of Premium", done.settled.settled === true && (await premiumDays(a.id)) === 1 && (await premiumDays(b.id)) === 1);
  await b.call("GET", "/study/referral");
  say("reward: it is granted once (no double reward)", (await premiumDays(a.id)) === 1 && (await premiumDays(b.id)) === 1);
  const sa = (await a.call("GET", "/study/referral")).body;
  say("status: the referrer sees the reward", sa.rewarded === 1 && sa.days_earned === 7 && sa.pending === 0);
  const plan = (await sql(`select entitlement, source, expires_at - now() as left from entitlements where user_id='${a.id}' and source='referral'`))[0];
  say("reward: it is a Premium right from the referral source that expires in about 7 days", plan.entitlement === "plan:premium" && /^6 days 2|^7 days|^6 days 23/.test(String(plan.left)), String(plan.left));
  // the cap
  for (let i = 0; i < 8; i++) { const f = await user(`amigo${i}`); await f.call("POST", "/study/referral/claim", { code: ra.code }); await studyDay(f.id, 1); await studyDay(f.id, 0); await f.call("GET", "/study/referral"); }
  const capped = (await sql(`select status, count(*)::int n from referrals where referrer_id='${a.id}' group by 1 order by 1`));
  say("cap: the referrer is rewarded at most 8 times; the rest still give the friend their days", capped.find((r) => r.status === "rewarded")?.n === 8 && capped.find((r) => r.status === "capped")?.n === 1, JSON.stringify(capped));
  // privacy
  say("privacy: another student cannot read the referral rows of others", (await c.sb.from("referrals").select("id")).data.length === 0 && (await c.sb.from("referral_codes").select("code")).data.length === 0);
  say("privacy: nobody can write referrals directly", (await b.sb.from("referrals").insert({ referrer_id: b.id, referred_id: c.id, code: "X" })).error !== null);
  say("privacy: nobody can grant themselves the reward directly", (await b.sb.from("entitlements").insert({ user_id: b.id, entitlement: "plan:premium", source: "referral" })).error !== null);

  // ---- browser ----
  const ctxB = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "pt-BR" });
  const p = await ctxB.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  const put = (k, v) => p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k, v });
  await p.goto(`${BASE}/termos?ind=${ra.code}`, { waitUntil: "networkidle" });
  const stored = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("pf-ref"); g.onsuccess = () => res(g.result); }; }));
  say("browser: the code in the link is remembered on the device", stored === ra.code);
  await put(`sb-${REF}-auth-token`, JSON.stringify(c.session));
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const claimed = (await sql(`select count(*)::int n from referrals where referred_id='${c.id}'`))[0].n;
  say("browser: after login the remembered code is claimed once and cleared", claimed === 1 && (await p.evaluate(() => new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("pf-ref"); g.onsuccess = () => res(g.result ?? null); }; }))) === null);
  await p.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-testid=referral-card]", { timeout: 15000 });
  say("account: the referral card shows the code and the rules", (await p.locator("[data-testid=referral-code]").innerText()).length === 7 && (await p.locator("text=7 dias de Premium").count()) > 0);
  // share card on a verse (opened from a map marker, like a student does)
  await put(`sb-${REF}-auth-token`, JSON.stringify(a.session));
  await p.goto(`${BASE}/visuais`, { waitUntil: "networkidle" });
  await p.click("button:text('A 2ª viagem missionária de Paulo')");
  await p.waitForSelector("[role=dialog] canvas", { timeout: 20000 });
  await p.waitForTimeout(9000);
  await p.locator("[role=dialog] .map-pin").nth(3).click();
  await p.locator("[role=dialog] button:has-text('Atos 16')").first().click();
  await p.waitForSelector("sup", { timeout: 10000 });
  await p.getByRole("button", { name: "Compartilhar cartão" }).last().click();
  await p.waitForSelector("[data-testid=share-card]", { timeout: 15000 });
  const dim = await p.locator("[data-testid=share-card]").evaluate((img) => [img.naturalWidth, img.naturalHeight]);
  say("share card: a 1080x1350 image is drawn on the device", dim[0] === 1080 && dim[1] === 1350, dim.join("x"));
  const alt = await p.locator("[data-testid=share-card]").getAttribute("alt");
  say("share card: it has a text alternative with the reference and the verse", /Atos 16/.test(alt ?? "") && (alt ?? "").length > 30);
  const dl = p.waitForEvent("download", { timeout: 10000 });
  await p.getByRole("button", { name: "Salvar imagem" }).click();
  const file = await dl;
  say("share card: the image can be saved as a PNG", /\.png$/.test(file.suggestedFilename()));
  await p.screenshot({ path: "/tmp/share-card.png" });
  say("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
