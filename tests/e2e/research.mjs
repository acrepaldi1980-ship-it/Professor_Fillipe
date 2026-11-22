// "Pesquisa profunda" end to end (real model and real library): opening a lesson, a sermon and a deep study with an empty document makes the
// app research and write the whole document by itself, with progress; then a change request in the conversation rewrites a section.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${!p && x ? "  >> " + String(x).slice(0, 400) : ""}`); };
const email = `rs-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch();
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${password}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  await sql(`insert into entitlements (user_id, entitlement, source) values ('${id}','plan:premium','admin')`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("response", async (r) => { if (/suggest/.test(r.url())) { const req = r.request().postData() ?? ""; if (r.status() >= 400 || /application/.test(req)) console.log("   SUGGEST", r.status(), req.slice(0, 60), (await r.text().catch(() => "")).slice(0, 300)); } });
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });

  if (!process.env.ONLY || process.env.ONLY === "deep") {
  // deep study: one passage, one click, the whole study is delivered
  await p.goto(`${BASE}/modos?m=deep`, { waitUntil: "networkidle" });
  await p.fill("input", "Atos 8:26-40");
  await p.click("button[type=submit]");
  await p.waitForSelector("[data-testid=research-bar]", { timeout: 30000 });
  say("deep: the research starts by itself and shows progress", (await p.locator("[role=status]:has-text('etapa')").count()) > 0 || (await p.locator("[role=status]:has-text('Documento pronto')").count()) > 0);
  await p.waitForSelector("text=Documento pronto", { timeout: 240000 }).catch(() => {});
  await p.waitForFunction(() => [...document.querySelectorAll("aside[aria-label='Estudo aprofundado'] h3")].some((h) => h.textContent === "Aplicação"), null, { timeout: 90000 }).catch(() => {});
  const secs = await p.locator("aside[aria-label='Estudo aprofundado'] h3").allTextContents();
  say(`deep: the study is delivered with its sections (${secs.length})`, ["Resumo do texto", "Contexto histórico e literário", "Estrutura do texto", "Palavras-chave no original", "Aplicação", "Referências cruzadas"].every((h) => secs.includes(h)), "have: " + secs.join(" | "));
  const sid = (await sql(`select id from sessions where user_id='${id}' and mode='deep' order by created_at desc limit 1`))[0].id;
  const deep = (await sql(`select data from deep_studies where session_id='${sid}'`))[0]?.data ?? {};
  say("deep: every key word comes from the original-language data (Strong number present)", (deep.keywords ?? []).length >= 3 && deep.keywords.every((k) => !!k.strong));
  say("deep: references are real Bible references and the bibliography lists library works", (deep.crossrefs ?? []).length > 0 && (deep.crossrefs ?? []).every((r) => /^[0-9A-Z]{3}\.\d+\.\d+(-[0-9A-Z]{3}\.\d+\.\d+)?$/.test(r)) && (deep.bibliography ?? []).length > 0);
  if (!(deep.crossrefs ?? []).length || !(deep.bibliography ?? []).length) console.log("   deep crossrefs/bibliography:", JSON.stringify(deep.crossrefs), JSON.stringify(deep.bibliography));
  // a change asked in the conversation
  const before = deep.overview;
  await p.fill("input[placeholder]", "Mude o resumo para ficar mais simples, para adolescentes");
  await p.click("button[type=submit]");
  await p.waitForFunction(() => document.body.innerText.includes("atualizei") || document.body.innerText.includes("ajustei"), null, { timeout: 120000 }).catch(() => {});
  const after = (await sql(`select data->>'overview' o from deep_studies where session_id='${sid}'`))[0].o;
  say("deep: asking for a change in the conversation rewrites the summary", !!after && after !== before);
  // the PDF
  const pdf = await p.evaluate(async (sessionId) => {
    const token = await new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").getAll(); g.onsuccess = () => res(JSON.parse(g.result.find((x) => typeof x === "string" && x.includes("access_token"))).access_token); }; });
    const r = await fetch(`/api/v1/sessions/${sessionId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    const b = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, head: String.fromCharCode(...b.slice(0, 5)), size: b.length };
  }, sid);
  say("deep: the study exports as a PDF", pdf.status === 200 && pdf.head === "%PDF-" && pdf.size > 2500);

  }
  // lesson and sermon: same behavior
  for (const [mode, fill, want, label] of ([["lesson", async () => { await p.fill("input >> nth=0", "Filipe e o eunuco etíope"); await p.fill("input >> nth=1", "Atos 8:26-40"); }, ["Objetivo", "Quebra-gelo", "Pontos principais", "Perguntas de discussão", "Aplicação"], "Refaça o quebra-gelo com algo mais divertido"], ["sermon", async () => { await p.fill("input", "Atos 8:26-40"); }, ["Ideia central", "Introdução", "Divisões", "Conclusão", "Apelo"], "Refaça a conclusão com mais emoção"]]).filter(([m]) => !process.env.ONLY || process.env.ONLY === m)) {
    await p.goto(`${BASE}/modos?m=${mode}`, { waitUntil: "networkidle" });
    await fill();
    await p.click("button[type=submit]");
    await p.waitForSelector("[data-testid=research-bar]", { timeout: 30000 });
    await p.waitForSelector("text=Documento pronto", { timeout: 240000 }).catch(() => {});
    await p.waitForFunction((w) => { const t = [...document.querySelectorAll("aside h3")].map((h) => h.textContent).join("|"); return w.every((x) => t.includes(x)) && document.body.innerText.includes("Nada faltando"); }, want, { timeout: 90000 }).catch(() => {});
    const h3 = (await p.locator("aside h3").allTextContents()).join("|");
    const complete = want.every((w) => h3.includes(w)) && (await p.locator("text=Nada faltando").count()) > 0;
    if (!complete) console.log("   remaining:", (await p.locator("aside section:has(h3:text('O que ainda falta')) li").allTextContents()).join(" | "), "| headings:", h3);
    say(`${mode}: the document is delivered complete with progress and no manual step`, complete);
    const sess = (await sql(`select id from sessions where user_id='${id}' and mode='${mode}' order by created_at desc limit 1`))[0].id;
    const tb = mode === "lesson" ? "lesson_plans" : "sermon_outlines";
    const doc1 = JSON.stringify((await sql(`select data from ${tb} where session_id='${sess}'`))[0].data);
    await p.fill("input[placeholder]", label);
    await p.click("button[type=submit]");
    await p.waitForFunction(() => document.body.innerText.includes("atualizei") || document.body.innerText.includes("ajustei"), null, { timeout: 120000 }).catch(() => {});
    const doc2 = JSON.stringify((await sql(`select data from ${tb} where session_id='${sess}'`))[0].data);
    say(`${mode}: a change asked in the conversation is applied to the document`, doc1 !== doc2);
  }
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
