// Church screens: the administrator registers the church and a class (QR Code appears), the student arrives by the invite link, confirms the
// privacy notice, and then sees the lesson of the week on the home screen.
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
const browser = await chromium.launch();
const made = [];
async function mk(label) {
  const id = randomUUID(), email = `cu-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1990-01-01',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGE ERROR", String(e).slice(0, 150)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });
  return { id, p, ctx, token: data.session.access_token };
}
try {
  const admin = await mk("admin"), student = await mk("aluna");
  const a = admin.p;
  await a.goto(`${BASE}/igreja`, { waitUntil: "networkidle" });
  await a.waitForSelector("text=Cadastrar a minha igreja", { timeout: 20000 });
  say("church screen: shows the privacy notice for everyone", (await a.locator("text=NÃO leem as suas conversas").count()) > 0);
  await a.fill("#church-name", "Igreja da Esperança");
  await a.click("button:text('Criar igreja')");
  await a.waitForSelector("h2:text('Igreja da Esperança')", { timeout: 20000 });
  say("church screen: the church is created, pending payment, with the payment button", (await a.locator("text=Aguardando o pagamento do plano").count()) > 0 && (await a.locator("button:text('Pagar o plano')").count()) === 1);
  await a.fill("[id^=cn-]", "Jovens da EBD");
  await a.click("button:text('Criar turma')");
  await a.waitForSelector("section[aria-label='Jovens da EBD']", { timeout: 20000 });
  await a.waitForSelector("img[alt^='QR Code']", { timeout: 20000 });
  const code = (await a.locator("section[aria-label='Jovens da EBD'] code").first().textContent())?.match(/c=([A-Z0-9]+)/)?.[1];
  say("class: the QR Code and the invite link are shown", !!code && /^C/.test(code));
  say("class: the teacher panel hides numbers under 5 students", (await a.locator("text=pelo menos 5 alunos participam").count()) > 0);
  // publish a lesson from the screen
  await a.fill("[id^=lt-]", "Filipe e o eunuco etíope");
  await a.fill("[id^=lr-]", "Atos 8:26-40");
  await a.click("button:text('Publicar')");
  await a.waitForSelector("li:has-text('Filipe e o eunuco')", { timeout: 20000 });
  say("lesson: published from the screen and listed", true);

  // the student arrives by the invite link, signed in
  const s = student.p;
  await s.goto(`${BASE}/entrar?c=${code}`, { waitUntil: "networkidle" });
  await s.waitForURL(/\/igreja/, { timeout: 20000 });
  await s.waitForSelector("[role=dialog]:has-text('Entrar em uma turma')", { timeout: 20000 });
  say("invite link: the student sees the privacy notice before joining", (await s.locator("[role=dialog] >> text=NÃO leem as suas conversas").count()) > 0);
  await s.click("[role=dialog] button:text('Entrar')");
  await s.waitForSelector("text=Você entrou", { timeout: 20000 });
  say("invite link: the student joined the class", (await sql(`select count(*)::int n from class_members where user_id='${student.id}'`))[0].n === 1);
  await s.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await s.waitForSelector("text=Lição da semana", { timeout: 20000 });
  say("home: the lesson of the week appears for the student", (await s.locator("a:has-text('Filipe e o eunuco etíope')").count()) === 1);
  await s.click("a:has-text('Filipe e o eunuco etíope')");
  await s.waitForURL(/\/estudo\?s=/, { timeout: 30000 });
  const linked = await sql(`select church_lesson_id from sessions where user_id='${student.id}' order by created_at desc limit 1`);
  say("study: the card opens a study session linked to the lesson", !!linked[0]?.church_lesson_id);
  await admin.ctx.close(); await student.ctx.close();
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 400));
  ok = false;
} finally {
  const ids = made.map((m) => `'${m}'`).join(",");
  await sql(`delete from churches where admin_user_id = any(array[${ids}]::uuid[])`).catch(() => {});
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
