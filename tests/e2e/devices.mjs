// Public pages and the closing feedback on phone, tablet and desktop: no horizontal scroll, no console errors, key content present.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3100";
let ok = true;
const say = (n, c) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (!c) ok = false; };
const browser = await chromium.launch();
const profiles = { "phone (iPhone 13)": devices["iPhone 13"], "phone (Pixel 7)": devices["Pixel 7"], "tablet (iPad)": devices["iPad (gen 7)"], desktop: { viewport: { width: 1366, height: 768 } } };
for (const [name, dev] of Object.entries(profiles)) {
  const ctx = await browser.newContext(dev);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["/", "/instalar", "/planos", "/login", "/termos", "/privacidade"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    say(`${name} ${path}: no horizontal scroll`, !overflow);
  }
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  say(`${name} /: slogan, plans, demo slot, install link`, (await p.locator("text=Entendes o que lês?").count()) > 0 && (await p.locator("text=R$ 29,90/mês").count()) > 0 && (await p.locator("[data-testid=demo-slot]").count()) === 1 && (await p.locator("a[href='/instalar']").count()) === 1);
  await p.goto(BASE + "/instalar", { waitUntil: "networkidle" });
  say(`${name} /instalar: iPhone steps shown`, (await p.locator("text=Adicionar à Tela de Início").count()) > 0);
  const manifest = await (await fetch(BASE + "/manifest.webmanifest")).json();
  say(`${name}: manifest is installable (name, icons 192/512, standalone)`, manifest.display === "standalone" && manifest.icons.length >= 2 && !!manifest.name);
  say(`${name}: no page errors`, errors.length === 0 || (console.log(errors), false));
  await ctx.close();
}

// closing feedback ("Como foi essa aula?")
const id = randomUUID(), em = `dev-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${em}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Dev','Dev','1980-01-01',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, granted, version) values ('${id}','terms',true,'t'),('${id}','privacy',true,'t'),('${id}','sensitive_religious',true,'t')`);
  const sid = randomUUID();
  await sql(`insert into sessions (id, user_id, mode, topic, started_at, ended_at) values ('${sid}','${id}','free','Filipe', now() - interval '1 hour', now())`);
  await sql(`insert into session_closings (session_id, summary, mind_map, topics) values ('${sid}','Dev, hoje você estudou Filipe. Seu desafio é explicar um texto a alguém?', '{"nodes":[{"id":"n1","label":"Filipe","group":"center"}],"edges":[]}'::jsonb, ARRAY['Atos 8'])`);
  const ctx = await browser.newContext(devices["iPhone 13"]);
  const p = await ctx.newPage();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email: em, password: pw });
  const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });
  await p.goto(`${BASE}/fechamento?s=${sid}`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Como foi essa aula?", { timeout: 20000 });
  await p.click("[role=radio][aria-label='5']");
  await p.fill("textarea[aria-label^='Quer deixar']", "Gostei muito");
  const before = (await sql("select count(*)::int n from feedback"))[0].n;
  await p.click("button:text('Enviar')");
  await p.waitForSelector("text=Obrigado pela sua opinião", { timeout: 20000 });
  const after = (await sql("select count(*)::int n from feedback"))[0].n;
  say("feedback: the rating is stored after the session", after === before + 1);
  await ctx.close();
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 400));
  ok = false;
} finally {
  await sql(`delete from feedback where session_ref is not null and comment = 'Gostei muito'`).catch(() => {});
  await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
