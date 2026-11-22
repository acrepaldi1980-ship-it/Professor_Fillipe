// Security and function test of the admin area (Prompt 1.12): a student, a reviewer and an admin call every admin route; the pages follow the role.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p) => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}`); };
const email = `adm-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch();
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("response", (r) => { if (r.url().includes("/document")) r.text().then((b) => console.log("DOC RESP", r.request().method(), r.status(), b.slice(0, 160))).catch(() => {}); });
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });
  // helper: a second and third user (reviewer and admin) with tokens, to call the API directly
  const mk = async (role) => {
    const uid = randomUUID(), em = `adm-${role}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
    await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${uid}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${em}', crypt('${pw}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
    await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, role) values ('${uid}','${role}','${role}','1980-01-01',false,'avançado',80,'${role}')`);
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { data: d } = await c.auth.signInWithPassword({ email: em, password: pw });
    return { uid, token: d.session.access_token };
  };
  const reviewer = await mk("reviewer");
  const admin = await mk("admin");
  const student = { token: data.session.access_token, uid: id };
  const call = async (who, method, path, body) => {
    const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${who.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const anon = async (path) => (await fetch(`${BASE}/api/v1${path}`)).status;

  // ---- every admin route is closed to the anonymous visitor and to a student ----
  const adminRoutes = [["GET", "/admin/works"], ["GET", "/admin/users"], ["GET", "/admin/metrics"], ["GET", "/admin/settings"], ["GET", "/admin/audit"], ["GET", "/admin/billing"], ["GET", "/admin/library"]];
  for (const [m, path] of adminRoutes) {
    say(`anonymous: ${path} is 401`, (await anon(path)) === 401);
    const r = await call(student, m, path);
    say(`student: ${path} is 403`, r.status === 403);
  }
  for (const [m, path, b] of [["PATCH", "/admin/works", { id: "x", enabled: false }], ["PATCH", "/admin/users", { userId: randomUUID(), role: "reviewer" }], ["PUT", "/admin/settings", { kind: "prompt_activate", layer: "identity", version: 1 }]]) {
    say(`student: ${m} ${path} is 403`, (await call(student, m, path, b)).status === 403);
  }
  say("student: flags and notes are 403", (await call(student, "GET", "/admin/flags")).status === 403 && (await call(student, "GET", "/admin/notes")).status === 403);

  // ---- a reviewer sees only the review screens ----
  say("reviewer: flagged answers and notes are open", (await call(reviewer, "GET", "/admin/flags")).status === 200 && (await call(reviewer, "GET", "/admin/notes")).status === 200);
  for (const [m, path] of adminRoutes) say(`reviewer: ${path} is 403 (admins only)`, (await call(reviewer, m, path)).status === 403);
  say("reviewer: cannot change settings or roles", (await call(reviewer, "PUT", "/admin/settings", { kind: "prompt_activate", layer: "identity", version: 1 })).status === 403 && (await call(reviewer, "PATCH", "/admin/users", { userId: student.uid ?? randomUUID(), role: "reviewer" })).status === 403);

  // ---- the admin can do everything and it is audited ----
  for (const [m, path] of adminRoutes.filter(([, p]) => p !== "/admin/library")) {
    const r = await call(admin, m, path);
    say(`admin: ${path} is 200`, r.status === 200);
  }
  const metrics = (await call(admin, "GET", "/admin/metrics")).body;
  say("admin: metrics include users, DAU/MAU, retention, conversion and the billing block", typeof metrics.users === "number" && "dau" in metrics && "retention" in metrics && metrics.billing && "mrr_brl" in metrics.billing);
  const users = (await call(admin, "GET", "/admin/users")).body.users;
  say("admin: users list has plan and situation but no conversation fields", users.length >= 3 && users.every((u) => !("messages" in u) && !("text" in u)) && users.some((u) => u.plan === "free"));
  const settings = (await call(admin, "GET", "/admin/settings")).body;
  say("admin: settings list plans, sermon types (4 with Explicativo) and prompt versions", settings.plans.length === 6 && ["free", "plus", "premium", "church_30", "church_100", "church_300"].every((id) => settings.plans.some((x) => x.id === id)) && settings.sermonTypes.some((t) => t.name === "Explicativo") && settings.prompts.length >= 2);

  // prompt versions: create v3 from v2 text with a marker, activate, then revert to v2; the teacher reads the active version
  const v2 = settings.prompts.find((p) => p.layer === "mode_free" && p.active);
  const created = await call(admin, "PUT", "/admin/settings", { kind: "prompt_new", layer: "mode_free", content: `${v2.content} (teste de versão do painel)` });
  const newVersion = created.body.version;
  say("admin: a new prompt version is saved (not active yet)", created.status === 200 && newVersion > v2.version);
  const act = await call(admin, "PUT", "/admin/settings", { kind: "prompt_activate", layer: "mode_free", version: newVersion });
  const live = await sql("select version from api_active_prompts() where layer = 'mode_free'");
  say("admin: activating changes what the teacher reads", act.status === 200 && live[0].version === newVersion);
  const back = await call(admin, "PUT", "/admin/settings", { kind: "prompt_activate", layer: "mode_free", version: v2.version });
  const live2 = await sql("select version from api_active_prompts() where layer = 'mode_free'");
  say("admin: reverting restores the earlier version", back.status === 200 && live2[0].version === v2.version);
  await sql(`delete from prompt_versions where layer='mode_free' and version=${newVersion}`);

  // works: disable and enable one work (audited)
  const works = (await call(admin, "GET", "/admin/works")).body.works;
  const w = works.find((x) => x.enabled && x.review_status === "approved");
  const off = await call(admin, "PATCH", "/admin/works", { id: w.id, enabled: false });
  const after = await sql(`select enabled from works where id='${w.id}'`);
  const on = await call(admin, "PATCH", "/admin/works", { id: w.id, enabled: true });
  say("admin: a work can be disabled and enabled again", off.status === 200 && after[0].enabled === false && on.status === 200 && (await sql(`select enabled from works where id='${w.id}'`))[0].enabled === true);

  // roles: make the student a reviewer, never an admin
  const sid = id;
  say("admin: can make a student a reviewer", (await call(admin, "PATCH", "/admin/users", { userId: sid, role: "reviewer" })).status === 200 && (await sql(`select role from profiles where user_id='${sid}'`))[0].role === "reviewer");
  say("admin: cannot create admins through the API", (await call(admin, "PATCH", "/admin/users", { userId: sid, role: "admin" })).status === 400);
  await sql(`update profiles set role='student' where user_id='${sid}'`);

  // flags: a student flags an answer, the reviewer reads question + answer and decides
  const sess = await sql(`insert into sessions (user_id, mode) values ('${sid}','free') returning id`);
  await sql(`insert into messages (session_id, role, text) values ('${sess[0].id}','user','Quem foi Filipe?')`);
  const msg = await sql(`insert into messages (session_id, role, text, speech, structured) values ('${sess[0].id}','teacher','Filipe foi um dos sete diáconos.','Filipe foi um dos sete diáconos.', '{"citations":[]}') returning id`);
  const flagged = await call(student, "POST", "/teacher/flag", { messageId: msg[0].id, reason: "achei estranho" });
  say("student: flags an answer from the app", flagged.status === 201);
  const list = (await call(reviewer, "GET", "/admin/flags")).body.flags;
  const mine = list.find((f) => f.message_id === msg[0].id);
  say("reviewer: sees the question and the answer, and nothing else of the conversation", !!mine && mine.question === "Quem foi Filipe?" && mine.answer.includes("sete diáconos") && !("session_id" in mine));
  const dec = await call(reviewer, "PATCH", "/admin/flags", { id: mine.flag_id, status: "incorrect", note: "faltou a fonte" });
  say("reviewer: marks it incorrect with a comment", dec.status === 200 && (await sql(`select status, reviewer_note from answer_flags where id='${mine.flag_id}'`))[0].status === "incorrect");

  // audit trail
  const audit = (await call(admin, "GET", "/admin/audit")).body.entries.map((e) => e.action);
  say("audit: prompt, work, role and flag actions are recorded", ["prompt_version_created", "prompt_activated", "work_disabled", "work_enabled", "role_changed", "flag_reviewed"].every((a) => audit.includes(a)));

  // analytics: events are allow-listed and free text is dropped
  const ev = await call(student, "POST", "/events", { event: "visual_opened", props: { kind: "map" } });
  const bad = await call(student, "POST", "/events", { event: "typed_text", props: { text: "x" } });
  await call(student, "POST", "/events", { event: "visual_opened", props: { kind: "map", note: "uma frase longa digitada pelo aluno com mais de quarenta caracteres, que não pode ser guardada" } });
  const stored = await sql(`select props from analytics_events where event='visual_opened' order by id desc limit 2`);
  say("analytics: only allow-listed events are accepted and long free text is dropped", ev.status === 202 && bad.status === 400 && stored.every((r) => !("note" in r.props)));

  // ---- the pages follow the role ----
  await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Esta página é só para administradores", { timeout: 20000 });
  say("page: a student opening /admin sees the forbidden message", true);
  await sql(`update profiles set role='admin' where user_id='${sid}'`);
  await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await p.waitForSelector("h1:text('Administração')", { timeout: 20000 });
  say("page: an admin sees the hub with every section", (await p.locator("main a").count()) >= 10 && (await p.locator("main a[href='/admin/ambientes']").count()) === 1);
  for (const [path, text] of [["/admin/obras", "Obras"], ["/admin/respostas", "Respostas sinalizadas"], ["/admin/usuarios", "Usuários"], ["/admin/metricas", "Métricas"], ["/admin/configuracoes", "Configurações"], ["/admin/auditoria", "Registro de ações"]]) {
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await p.waitForSelector(`h1:text('${text}')`, { timeout: 20000 }).catch(() => {});
    say(`page: ${path} opens for an admin`, (await p.locator(`h1:text('${text}')`).count()) > 0);
  }
  say("no page errors", errors.length === 0 || (console.log(errors), false));
  await ctx.close();
  for (const u of [reviewer.uid, admin.uid]) await sql(`delete from auth.users where id='${u}'`).catch(() => {});
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 500));
  ok = false;
} finally {
  await sql(`delete from analytics_events where user_id='${id}'`).catch(() => {});
  await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await sql(`delete from auth.users where email like 'adm-%@example.test'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
