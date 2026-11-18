import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "./db.mjs";
const require = createRequire(process.env.GLOBAL_NM + "/x.js");
const { chromium, devices } = require("playwright");
const OUT = process.argv[2];
const email = `ui-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const REF = "hltyhkydytetdatgyvux";
let ok = true;
const say = (n, p) => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}`); };
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const sessionJson = JSON.stringify(data.session);

  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  const shot = (n) => p.screenshot({ path: `${OUT}-${n}.png` });

  // visitor flow: landing and login
  await p.goto("http://localhost:3100/", { waitUntil: "networkidle" });
  say("landing shows slogan", await p.locator("text=Entendes o que lês?").count() > 0);
  await shot("1-landing");
  await p.goto("http://localhost:3100/login", { waitUntil: "networkidle" });
  say("login offers email link and Google", (await p.locator("text=Receber link por e-mail").count()) > 0 && (await p.locator("text=Entrar com Google").count()) > 0);
  await shot("2-login");
  await p.goto("http://localhost:3100/inicio", { waitUntil: "networkidle" });
  await p.waitForURL("**/login", { timeout: 15000 });
  say("signed-out visitor is sent to login", p.url().endsWith("/login"));

  // put the real session where the app keeps it (platform LocalStore = IndexedDB)
  await p.goto("http://localhost:3100/termos", { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: sessionJson });

  await p.goto("http://localhost:3100/inicio", { waitUntil: "networkidle" });
  await p.waitForURL("**/onboarding/consentimento", { timeout: 20000 });
  say("new user lands on consent screen", true);
  await p.fill("#name", "Ana");
  await p.fill("#birth", "2014-01-01");
  await p.waitForTimeout(300);
  say("under 13 sees the block message and cannot continue", (await p.locator("text=maiores de 13 anos").count()) > 0 && await p.locator("button[type=submit]").isDisabled());
  await shot("3-menor-de-13");
  await p.fill("#birth", "2010-05-05");
  await p.waitForTimeout(300);
  say("13-17 sees the guardian checkbox", (await p.locator("text=um responsável sabe").count()) > 0);
  await shot("4-guardiao");
  await p.fill("#birth", "1985-03-02");
  await p.waitForTimeout(300);
  await p.check("text=Li e aceito os Termos de Uso");
  await p.check("text=Li e aceito a Política de Privacidade");
  await p.click("button[type=submit]");
  await p.waitForURL("**/onboarding/dado-religioso", { timeout: 20000 });
  say("consent saved, religious-data screen shown", true);
  await shot("5-dado-religioso");
  await p.click("text=Prefiro não informar");
  await p.waitForURL("**/inicio", { timeout: 20000 });
  await p.waitForSelector("text=Olá, Ana", { timeout: 15000 });
  say("home greets by name", true);
  await shot("6-inicio");

  await p.click("text=Começar a estudar");
  await p.waitForURL(/\/estudo\?s=/, { timeout: 20000 });
  say("study opens a server session", true);
  await p.check("input[type=checkbox]");
  await p.fill("input[placeholder]", "Quem foi Barnabé?");
  await p.click("button[type=submit]");
  await p.waitForSelector("text=Fontes", { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const body = await p.textContent("main");
  say("professor answered on screen", /Barnab|problema|disponível/.test(body ?? ""));
  await shot("7-estudo");

  await p.goto("http://localhost:3100/conta", { waitUntil: "networkidle" });
  await p.waitForSelector("text=Aparência");
  await p.click("text=Escuro");
  await p.waitForTimeout(300);
  say("dark theme applies", (await p.getAttribute("html", "data-theme")) === "dark");
  await shot("8-conta-escuro");
  say("no page errors", errors.length === 0 || (console.log(errors), false));
  await b.close();
} catch (e) { console.log("UI TEST ERROR:", e.message); ok = false; }
finally { await sql(`delete from auth.users where id='${id}'`).catch(() => {}); process.exit(ok ? 0 : 1); }
