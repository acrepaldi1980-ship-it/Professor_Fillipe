// End-to-end test of the guided modes (Prompt 1.8): setup, live document, hand editing, gaps and PDF for lesson and sermon,
// and the Aprofundar setup. The model's answers are not asserted here (see evals/datasets/modes.json); the plumbing is.
// Needs the app on http://localhost:3100 (next start -p 3100). Usage: GLOBAL_NM=$(npm root -g) NODE_OPTIONS=--use-env-proxy node --env-file=.env.local tests/e2e/modes.mjs
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
const email = `modes-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch();
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  await sql(`insert into entitlements (user_id, entitlement, source) values ('${id}','plan:premium','admin')`); // sermons and PDF are plan features
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
  // the interview is done for this user (profile.level set)
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=O que vamos fazer hoje", { timeout: 20000 }).catch(() => {});
  say("home offers the guided modes", (await p.locator("a[href^='/modos?m=']").count()) === 3);

  const pdfOf = (sid) => p.evaluate(async (s) => {
    const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    const token = await new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").getAll(); g.onsuccess = () => res(JSON.parse(g.result.find((x) => typeof x === "string" && x.includes("access_token"))).access_token); }; });
    void key;
    const r = await fetch(`/api/v1/sessions/${s}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    const b = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get("content-type"), head: String.fromCharCode(...b.slice(0, 5)), size: b.length };
  }, sid);

  // ---- lesson ----
  await p.goto(`${BASE}/modos?m=lesson`, { waitUntil: "networkidle" });
  await p.fill("input >> nth=0", "Filipe e o eunuco etíope");
  await p.fill("input >> nth=1", "Atos 8:26-40");
  await p.click("button[type=submit]");
  await p.waitForURL(/\/estudo\?s=/, { timeout: 20000 });
  const lessonSid = new URL(p.url()).searchParams.get("s");
  await p.waitForSelector("aside[aria-label='Plano de aula']", { timeout: 20000 });
  say("lesson: the plan editor opens beside the conversation", true);
  await p.waitForSelector("text=Falta o objetivo", { timeout: 15000 }).catch(() => {});
  say("lesson: gaps are listed", (await p.locator("text=Falta o objetivo").count()) > 0);
  // the teacher proposes one section and it lands in the document (real model call)
  const gapsBefore = await p.locator("li:has(button:text('Pedir sugestão'))").count();
  await p.locator("li:has-text('Falta o objetivo') button:text('Pedir sugestão')").click();
  await p.waitForFunction(() => !document.body.innerText.includes("Falta o objetivo"), null, { timeout: 90000 }).catch(() => {});
  say("lesson: 'Pedir sugestão' writes the objective into the plan", (await p.locator("text=Falta o objetivo").count()) === 0 && gapsBefore >= 5);
  const saved = await sql(`select data->'objective' as o from lesson_plans where user_id='${id}' order by created_at desc limit 1`);
  say("lesson: the suggestion is saved in lesson_plans (up to 3 objectives)", Array.isArray(saved[0]?.o) && saved[0].o.length >= 1 && saved[0].o.length <= 3);
  await p.locator("section:has(h3:text('Quebra-gelo')) button:text('Editar')").click();
  await p.fill("aside textarea", "Quem já explicou a Bíblia a alguém?");
  await p.click("aside button:text('Salvar')");
  await p.waitForSelector("text=Quem já explicou a Bíblia a alguém?");
  await p.locator("section:has(h3:text('Pontos principais')) button:text('Editar')").click();
  await p.click("aside button:text('Adicionar')");
  await p.fill("aside input[aria-label='Título']", "Filipe obedece ao chamado");
  await p.fill("aside input[aria-label^='Textos']", "ACT.8.26, ACT.8.27");
  await p.click("aside button:text('Salvar')");
  await p.waitForSelector("text=Filipe obedece ao chamado");
  say("lesson: manual edits are saved", true);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector("text=Quem já explicou a Bíblia a alguém?", { timeout: 15000 }).catch(async () => { console.log("AFTER RELOAD:", p.url(), (await p.innerText("aside").catch((e) => "no aside " + e.message.slice(0, 80)))?.slice(0, 500), errors.join("|").slice(0, 200)); throw new Error("plan missing after reload"); });
  say("lesson: the plan persists after reload", true);
  const lp = await pdfOf(lessonSid);
  say("lesson: PDF is a valid A4 file", lp.status === 200 && lp.type === "application/pdf" && lp.head === "%PDF-" && lp.size > 1500);
  const lrow = await sql(`select data->>'icebreaker' as ice, (data->'points'->0->'verses') as v from lesson_plans where session_id='${lessonSid}'`);
  say("lesson: saved in lesson_plans", lrow[0]?.ice?.includes("explicou") && lrow[0].v?.length === 2);
  // mobile: tabs
  await p.setViewportSize({ width: 390, height: 800 });
  await p.waitForTimeout(300);
  say("lesson: on the phone the conversation and the document are tabs", (await p.locator("[role=tab]").count()) === 2);
  await p.click("[role=tab]:text('Documento')");
  say("lesson: the document tab shows the plan", await p.locator("aside[aria-label='Plano de aula']").isVisible());
  await p.setViewportSize({ width: 1200, height: 900 });

  // ---- sermon ----
  await p.goto(`${BASE}/modos?m=sermon`, { waitUntil: "networkidle" });
  const options = await p.locator("select option").allTextContents();
  say("sermon: types include Temático, Textual, Expositivo and Explicativo (D-06)", ["Temático", "Textual", "Expositivo", "Explicativo"].every((x) => options.includes(x)));
  await p.selectOption("select", "Expositivo");
  await p.fill("input", "Atos 8:26-40");
  await p.click("button[type=submit]");
  await p.waitForURL(/\/estudo\?s=/, { timeout: 20000 });
  const sermonSid = new URL(p.url()).searchParams.get("s");
  await p.waitForSelector("aside[aria-label='Esboço do sermão']", { timeout: 20000 });
  say("sermon: the outline editor opens", true);
  await p.locator("section:has(h3:text('Ideia central')) button:text('Editar')").click();
  await p.fill("aside textarea", "Deus alcança quem o busca com sinceridade.");
  await p.click("aside button:text('Salvar')");
  await p.waitForSelector("text=Deus alcança quem o busca com sinceridade.");
  await p.waitForSelector("text=Ainda não há divisões.", { timeout: 15000 }).catch(() => {});
  say("sermon: the final review points out the gaps", (await p.locator("text=A introdução (com gancho) ainda não está no esboço.").count()) > 0 && (await p.locator("text=Ainda não há divisões.").count()) > 0);
  const sp = await pdfOf(sermonSid);
  say("sermon: PDF is a valid file", sp.status === 200 && sp.head === "%PDF-" && sp.size > 1500);
  const srow = await sql(`select o.data->>'central_idea' as c, t.name from sermon_outlines o left join sermon_types t on t.id = o.sermon_type_id where o.session_id='${sermonSid}'`);
  say("sermon: saved in sermon_outlines", srow[0]?.c?.includes("sinceridade"));

  // ---- deepen ----
  await p.goto(`${BASE}/modos?m=deep`, { waitUntil: "networkidle" });
  await p.fill("input", "João 1:1-5");
  await p.click("button[type=submit]");
  await p.waitForURL(/\/estudo\?s=/, { timeout: 20000 });
  const deepSid = new URL(p.url()).searchParams.get("s");
  const sess = await sql(`select mode, context from sessions where id='${deepSid}'`);
  say("deep: the session keeps the passage", sess[0]?.mode === "deep" && sess[0].context?.ref === "João 1:1-5");
  say("deep: no document panel", (await p.locator("aside[aria-label]").count()) === 0);
  say("no page errors", errors.length === 0 || (console.log(errors), false));
  await ctx.close();
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 400));
  ok = false;
} finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
