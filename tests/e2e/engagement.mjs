// Guided paths and study streak end to end (Prompt 2.7): API (progress, completion, milestones, streak, privacy) and the screens
// (home streak and path card, /trilhas, the day opened with the teacher and completed from the study screen).
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
  const id = randomUUID(), email = `en-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, session: data.session, token: data.session.access_token };
  u.call = async (method, path, body) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return u;
}
const studyDay = async (uid, daysAgo) => { const s = randomUUID(); await sql(`insert into sessions (id, user_id, mode) values ('${s}','${uid}','free')`); await sql(`insert into messages (session_id, role, text, created_at) values ('${s}','user','oi', now() - interval '${daysAgo} days')`); };

const browser = await chromium.launch();
try {
  const a = await user("ana"), b = await user("beto");
  // ---- paths ----
  const list = await a.call("GET", "/study/paths");
  say("paths: three guided paths are offered, none started", list.status === 200 && list.body.paths.length === 3 && list.body.paths.every((p) => !p.started && p.done === 0));
  const at = list.body.paths.find((p) => p.id === "parabolas14");
  say("paths: each has its size and the first day to study", at.total === 14 && at.next_day.day === 1);
  say("paths: an unknown path is 404", (await a.call("GET", "/study/paths/nao-existe")).status === 404);
  say("paths: starting is idempotent", (await a.call("POST", "/study/paths/start", { pathId: "parabolas14" })).status === 200 && (await a.call("POST", "/study/paths/start", { pathId: "parabolas14" })).status === 200 && (await sql(`select count(*)::int n from path_progress where user_id='${a.id}'`))[0].n === 1);
  const d1 = await a.call("POST", "/study/paths/day", { pathId: "parabolas14", day: 1 });
  say("paths: completing a day records progress", d1.body.done === 1 && d1.body.completed === false);
  await a.call("POST", "/study/paths/day", { pathId: "parabolas14", day: 1 });
  say("paths: completing the same day twice does not count twice", (await a.call("GET", "/study/paths/parabolas14")).body.done === 1);
  say("paths: a day outside the path is refused (400)", (await a.call("POST", "/study/paths/day", { pathId: "parabolas14", day: 15 })).status === 400);
  const det = (await a.call("GET", "/study/paths/parabolas14")).body;
  say("paths: the detail marks done days and the next one", det.days[0].done === true && det.next_day.day === 2 && det.days.length === 14);
  let last;
  for (let d = 2; d <= 14; d++) last = await a.call("POST", "/study/paths/day", { pathId: "parabolas14", day: d });
  say("paths: finishing the last day completes the path and records a milestone", last.body.completed === true && last.body.milestone === "path_parabolas14" && (await sql(`select count(*)::int n from user_milestones where user_id='${a.id}' and kind='path_parabolas14'`))[0].n === 1);
  say("privacy: another student's progress is untouched", (await b.call("GET", "/study/paths")).body.paths.every((p) => p.done === 0));
  say("privacy: RLS hides progress rows from other users", (await createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${b.token}` } } }).from("path_progress").select("id")).data.length === 0);
  say("paths: unauthenticated is refused (401)", (await fetch(`${BASE}/api/v1/study/paths`)).status === 401);

  // ---- a day opened with the teacher ----
  const s = await a.call("POST", "/sessions", { mode: "free", pathId: "paulo14", pathDay: 2 });
  const ctx = (await sql(`select context, topic from sessions where id='${s.body.sessionId}'`))[0];
  say("trail: the session carries the day (title, passage, goal) from our own content", ctx.context.trail?.title === "O encontro no caminho de Damasco" && ctx.context.trail.ref === "ACT.9.1-ACT.9.31" && /Paulo/.test(ctx.topic));
  say("trail: an invalid day is refused (404)", (await a.call("POST", "/sessions", { mode: "free", pathId: "paulo14", pathDay: 40 })).status === 404);

  // ---- streak ----
  say("streak: no study yet means no streak", (await a.call("GET", "/study/streak")).body.current === 0);
  for (const n of [0, 1, 2, 3]) await studyDay(b.id, n);
  await studyDay(b.id, 6);
  const st = await b.call("GET", "/study/streak?tz=America%2FSao_Paulo");
  say("streak: four consecutive days up to today", st.body.current === 4 && st.body.studied_today === true && st.body.total_days === 5, JSON.stringify(st.body));
  say("streak: the best run and the milestone of 3 days", st.body.best === 4 && st.body.new_milestones.includes("streak_3") && !st.body.new_milestones.includes("streak_7"));
  await b.call("GET", "/study/streak?tz=America%2FSao_Paulo&ack=1");
  say("streak: a milestone is announced only once", (await b.call("GET", "/study/streak?tz=America%2FSao_Paulo")).body.new_milestones.length === 0);
  say("streak: an unknown time zone falls back instead of failing", (await b.call("GET", "/study/streak?tz=Nao%2FExiste")).status === 200);
  const c = await user("carla");
  await studyDay(c.id, 1); await studyDay(c.id, 2);
  const sc = (await c.call("GET", "/study/streak")).body;
  say("streak: not studying today keeps the streak alive until the day ends", sc.current === 2 && sc.studied_today === false);

  // ---- screens ----
  const ctxB = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "pt-BR" });
  const p = await ctxB.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  const put = (sess) => p.evaluate(async ({ key: k, value }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(sess) });
  await put(b.session);
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-testid=streak]", { timeout: 15000 });
  say("home: shows the streak gently", /4 dias seguidos/.test(await p.locator("[data-testid=streak]").innerText()));
  say("home: offers a guided path", (await p.locator("text=Trilha guiada").count()) > 0 && (await p.locator("text=Panorama do Antigo Testamento").count()) > 0);
  await p.goto(`${BASE}/trilhas`, { waitUntil: "networkidle" });
  say("paths screen: lists the three paths", (await p.locator("main ul li button").count()) === 3);
  await p.locator("main ul li button", { hasText: "vida de Paulo" }).click();
  await p.waitForSelector("[data-testid=path-day]", { timeout: 10000 });
  say("paths screen: the path opens with its 14 days", (await p.locator("[data-testid=path-day]").count()) === 14);
  await p.locator("[data-testid=path-day] a", { hasText: "Estudar este dia" }).nth(1).click();
  await p.waitForSelector("[data-testid=trail-banner]", { timeout: 20000 });
  say("study: the day opens with a banner for the path day", /dia 2/.test(await p.locator("[data-testid=trail-banner]").innerText()));
  await p.getByRole("button", { name: "Concluir o dia" }).click();
  await p.waitForSelector("text=Dia concluído!", { timeout: 10000 });
  say("study: completing the day from the banner records it", (await b.call("GET", "/study/paths/paulo14")).body.days[1].done === true);
  say("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
