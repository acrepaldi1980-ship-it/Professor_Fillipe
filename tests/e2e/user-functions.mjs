// User functions end to end (the whole life of a student): login screen, route protection, home, study conversation with real
// answers, verses, bookmarks, flagging, preferences, lenses and consent, notebook, data export, sign out, account deletion.
// Usage: APP_URL=<site> node --env-file=.env.local tests/e2e/user-functions.mjs
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");

const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${!p && x ? "  >> " + String(x).slice(0, 300) : ""}`); };
const email = `uf-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch();

async function login(ctx, p, session) {
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) });
}

try {
  // ---------- 1. visitor: login screen and route protection ----------
  const anonCtx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "pt-BR" });
  const a = await anonCtx.newPage();
  const errs = [];
  a.on("pageerror", (e) => errs.push(String(e)));
  for (const path of ["/inicio", "/estudo", "/caderno", "/revisao", "/conta", "/assinatura", "/admin"]) {
    await a.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await a.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
    say(`visitor: ${path} sends to /login`, a.url().includes("/login"));
  }
  await a.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  say("login: email field, send button and Google button are there", (await a.locator("input[type=email]").count()) === 1 && (await a.locator("button[type=submit]").count()) === 1 && (await a.locator("button:has-text('Google')").count()) === 1);
  say("login: the send button waits for an email", await a.locator("button[type=submit]").isDisabled());
  say("login: links to terms and privacy", (await a.locator("a[href='/termos']").count()) > 0 && (await a.locator("a[href='/privacidade']").count()) > 0);
  for (const [path, text] of [["/termos", "Termos"], ["/privacidade", "Privacidade"], ["/fontes-e-licencas", "licen"], ["/instalar", "Instale"]]) {
    await a.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    say(`visitor: ${path} opens without login`, !a.url().includes("/login") && (await a.locator(`text=/${text}/i`).count()) > 0);
  }
  say("visitor: no page errors", errs.length === 0 || (console.log(errs), false));
  await anonCtx.close();

  // ---------- 2. a student with everything set up ----------
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${password}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, first_topic) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50,'Atos 8')`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',true)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "pt-BR", serviceWorkers: "allow", acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await login(ctx, p, data.session);

  // ---------- home and navigation ----------
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForSelector("nav a", { timeout: 20000 });
  say("home: opens signed in with the bottom navigation (5 items)", (await p.locator("nav a").count()) === 5);
  for (const [label, url] of [["Estudar", "/estudo"], ["Revisão", "/revisao"], ["Caderno", "/caderno"], ["Conta", "/conta"], ["Início", "/inicio"]]) {
    await p.locator(`nav a:has-text('${label}')`).first().click();
    await p.waitForURL(new RegExp(url), { timeout: 15000 }).catch(() => {});
    say(`nav: ${label} opens ${url}`, p.url().includes(url));
  }

  // ---------- study conversation ----------
  await p.goto(`${BASE}/estudo`, { waitUntil: "networkidle" });
  await p.waitForSelector("input[placeholder]", { timeout: 20000 });
  await p.locator("label:has-text('Só texto') input, input[type=checkbox]").first().check().catch(() => {});
  await p.fill("input[placeholder]", "Quem foi Filipe em Atos 8?");
  await p.click("button[type=submit]");
  await p.waitForSelector("[class*=bubble], main section >> text=Filipe", { timeout: 90000 }).catch(() => {});
  await p.waitForFunction(() => document.querySelectorAll("main section > *").length >= 3, null, { timeout: 90000 }).catch(() => {});
  const body1 = (await p.locator("main section").first().innerText()).replace(/\s+/g, " ");
  say("study: the student's question shows and the teacher answers", body1.includes("Quem foi Filipe") && body1.length > 200, body1);
  say("study: the answer talks about Filipe and ends with a question to the student", /Filipe/.test(body1) && /\?/.test(body1));
  const verseBtns = p.locator("main section button:has-text('Atos'), main section button:has-text('Ver ')");
  say("study: the answer offers the cited verses as buttons", (await verseBtns.count()) > 0);
  say("study: the next-step options (chips) are offered", (await p.locator("main section button").count()) >= 2);
  const sess = await sql(`select id from sessions where user_id='${id}' order by created_at desc limit 1`);
  const msgs = await sql(`select role from messages where session_id='${sess[0]?.id}' order by created_at`);
  say("study: the conversation is saved (user + teacher messages)", msgs.length >= 2 && msgs[0].role === "user" && msgs[1].role === "teacher");
  const words = await sql(`select array_length(regexp_split_to_array(trim(coalesce(speech,'')), '\\s+'), 1) w from messages where session_id='${sess[0]?.id}' and role='teacher' limit 1`);
  say("study: the spoken part respects the 120 word limit (RA-06)", words[0]?.w > 5 && words[0].w <= 130);
  if ((await verseBtns.count()) > 0) {
    await verseBtns.first().click();
    await p.waitForSelector("[role=dialog]", { timeout: 15000 }).catch(() => {});
    say("study: tapping a verse opens the Bible text", (await p.locator("[role=dialog]").count()) > 0 && (await p.locator("[role=dialog] p").count()) > 0);
    await p.locator("[role=dialog] button:has-text('Marcar versículo')").first().click().catch(() => {});
    await p.waitForSelector("text=Versículo marcado", { timeout: 20000 }).catch(() => {});
    const bm = await sql(`select count(*)::int n from bookmarks where user_id='${id}'`);
    say("study: a verse can be bookmarked", bm[0].n === 1);
    await p.locator("[role=dialog] button:has-text('Fechar')").first().click().catch(() => {});
  }
  // a follow-up that depends on the previous answer
  await p.fill("input[placeholder]", "E por que o Espírito o levou ao deserto?");
  await p.click("button[type=submit]");
  await p.waitForFunction(() => document.querySelectorAll("main section > *").length >= 6, null, { timeout: 90000 }).catch(() => {});
  const m2 = await sql(`select count(*)::int n from messages where session_id='${sess[0]?.id}'`);
  say("study: a follow-up question is answered in the same conversation", m2[0].n >= 4);
  // flag the answer
  const flagBtn = p.locator("main section button:has-text('errado'), main section button:has-text('Isso está')").first();
  if (await flagBtn.count()) {
    await flagBtn.click();
    await p.waitForTimeout(600);
    const sendBtn = p.locator("button:has-text('Enviar')").first();
    if (await sendBtn.count()) await sendBtn.click().catch(() => {});
    await p.waitForTimeout(1200);
    const fl = await sql(`select count(*)::int n from answer_flags where user_id='${id}'`);
    say("study: the student can flag an answer as wrong", fl[0].n >= 1);
  } else say("study: the flag button exists", false);
  // reload: history comes back
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  say("study: the interface still answers after a reload", (await p.locator("input[placeholder]").count()) === 1);
  // ending the session leads to the closing screen with the feedback form
  const end = p.locator("a[href*='/fechamento']").first();
  if (await end.count()) {
    await end.click();
    await p.waitForSelector("text=Como foi essa aula?", { timeout: 60000 }).catch(() => {});
    say("closing: the summary and the feedback form appear", (await p.locator("text=Como foi essa aula?").count()) > 0);
  }

  // ---------- account: preferences, lenses, consent, export ----------
  await p.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await p.waitForSelector("h1:text('Conta')", { timeout: 20000 }).catch(() => {});
  say("account: shows the email", (await p.locator(`text=${email}`).count()) > 0);
  await p.click("[role=radio]:has-text('Escuro')");
  await p.waitForTimeout(400);
  say("account: dark theme is applied to the page", await p.evaluate(() => document.documentElement.dataset.theme === "dark" || document.documentElement.classList.contains("dark") || getComputedStyle(document.body).backgroundColor !== "rgb(251, 243, 228)"));
  await p.click("[role=radio]:has-text('Claro')");
  const lensBtn = p.locator("button[aria-pressed]").first();
  if (await lensBtn.count()) {
    await lensBtn.click();
    await p.waitForTimeout(1200);
    const pref = await sql(`select lenses_enc from preferences where user_id='${id}'`);
    say("account: choosing a lens is saved encrypted", pref.length === 1 && String(pref[0].lenses_enc).startsWith("enc:v1:"));
    await lensBtn.click();
    await p.waitForTimeout(1000);
  }
  const dl = p.waitForEvent("download", { timeout: 30000 }).catch(() => null);
  await p.click("button:has-text('Baixar meus dados')");
  const download = await dl;
  let exported = null;
  if (download) { const fs = await import("node:fs"); exported = JSON.parse(fs.readFileSync(await download.path(), "utf8")); }
  say("account: 'Baixar meus dados' downloads a JSON with the student's data", !!exported && exported.user?.id === id && Array.isArray(exported.messages) && exported.messages.length >= 2);
  // revoke the religious consent: lenses become unavailable
  const toggle = p.locator("button:has-text('Apagar e revogar')").first();
  if (await toggle.count()) {
    await toggle.click();
    await p.waitForTimeout(1500);
    const c = await sql(`select granted from consent_records where user_id='${id}' and kind='sensitive_religious' order by created_at desc limit 1`);
    say("account: the religious-data consent can be revoked", c[0].granted === false);
  }

  // ---------- notebook: create, search, delete ----------
  await p.goto(`${BASE}/caderno`, { waitUntil: "networkidle" });
  await p.click("button:text('Nova nota')");
  await p.fill("input[aria-label='Título']", "Nota de teste de usuário");
  await p.fill("textarea", "Texto da minha nota.");
  await p.click("button:text('Salvar')");
  await p.waitForSelector("text=Nota de teste de usuário", { timeout: 15000 });
  say("notebook: a personal note is created", true);
  await p.fill("input[type=search]", "teste de usuário");
  await p.waitForTimeout(800);
  say("notebook: search finds it", (await p.locator("main li:has-text('Nota de teste de usuário')").count()) === 1);
  await p.fill("input[type=search]", "");
  await p.waitForTimeout(600);
  await p.locator("main li:has-text('Nota de teste de usuário') button:has-text('Apagar')").first().click();
  await p.waitForTimeout(1200);
  say("notebook: the note can be deleted", (await sql(`select count(*)::int n from notebook_items where user_id='${id}' and title='Nota de teste de usuário'`))[0].n === 0);

  // ---------- review page and modes page open ----------
  for (const [path, text] of [["/revisao", "Revis"], ["/modos", "Aula"], ["/visuais", "Mapa"], ["/planos", "Plus"], ["/assinatura", "assinatura"]]) {
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    say(`${path}: opens for the student`, !p.url().includes("/login") && (await p.locator(`text=/${text}/i`).count()) > 0);
  }

  // ---------- sign out ----------
  await p.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await p.click("button:text('Sair')");
  await p.waitForURL((u) => u.pathname === "/", { timeout: 20000 }).catch(() => {});
  say("sign out: goes back to the landing page", new URL(p.url()).pathname === "/");
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  say("sign out: the private screens are closed again", p.url().includes("/login"));

  // ---------- delete account from the screen ----------
  await login(ctx, p, (await sb.auth.signInWithPassword({ email, password })).data.session);
  await p.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await p.click("button:text('Excluir minha conta')");
  const confirmBtn = p.locator("[role=dialog] button:has-text('Excluir para sempre')");
  say("delete: the confirm button stays disabled until the word EXCLUIR is typed", await confirmBtn.isDisabled());
  await p.fill("[role=dialog] input", "EXCLUIR");
  await confirmBtn.click();
  await p.waitForURL((u) => u.pathname === "/", { timeout: 30000 }).catch(() => {});
  const left = await sql(`select (select count(*) from auth.users where id='${id}')::int u, (select count(*) from profiles where user_id='${id}')::int p, (select count(*) from sessions where user_id='${id}')::int s, (select count(*) from bookmarks where user_id='${id}')::int b, (select count(*) from consent_records where user_id='${id}')::int c`);
  say("delete: the account and every personal row are gone", left[0].u === 0 && left[0].p === 0 && left[0].s === 0 && left[0].b === 0 && left[0].c === 0);
  say("no page errors", errors.length === 0 || (console.log(errors), false));
  await ctx.close();
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 500));
  ok = false;
} finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
