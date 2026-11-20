// End-to-end test of closing, review and notebook (Prompt 1.10): closing screen with mind map, review with SM-2 rescheduling, notebook search, personal note, PDF export and offline mode.
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
const email = `rev-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch();
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, locale: "pt-BR", serviceWorkers: "allow" });
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
  // seed: one finished session with its closing and 3 cards due now
  const sid = randomUUID();
  await sql(`insert into sessions (id, user_id, mode, topic, started_at, ended_at) values ('${sid}','${id}','free','Filipe e o eunuco etíope', now() - interval '1 hour', now())`);
  const map = JSON.stringify({ nodes: [{ id: "n1", label: "Filipe", group: "center" }, { id: "n2", label: "Samaria", group: "topic" }, { id: "n3", label: "Eunuco etíope", group: "topic" }, { id: "n4", label: "Atos 8:30", group: "detail" }], edges: [{ from: "n1", to: "n2" }, { from: "n1", to: "n3" }, { from: "n3", to: "n4" }] });
  const summary = "Marcos, hoje você estudou Filipe, um dos sete diáconos, que levou o evangelho a Samaria e ao eunuco etíope em Atos 8. Ele perguntou: entendes o que lês? Seu desafio é explicar um texto a alguém esta semana.";
  await sql(`insert into session_closings (session_id, summary, mind_map, topics) values ('${sid}','${summary}','${map}'::jsonb, ARRAY['Atos 8'])`);
  await sql(`insert into notebook_items (user_id, session_id, kind, title, content, tags, book_codes) values ('${id}','${sid}','session','Filipe e o eunuco etíope', jsonb_build_object('summary','${summary}','mind_map','${map}'::jsonb), ARRAY['Atos 8'], ARRAY['ACT'])`);
  await sql(`insert into review_cards (user_id, session_id, question, answer, ref) values ('${id}','${sid}','O que o eunuco estava lendo?','O livro do profeta Isaías.','ISA.53.7'),('${id}','${sid}','Por que Filipe perguntou se ele entendia?','Para abrir a conversa e explicar o texto a partir da dúvida dele.','ACT.8.30'),('${id}','${sid}','Qual era a função de Filipe antes de Samaria?','Um dos sete escolhidos para servir às mesas.','ACT.6.5')`);

  // home
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Continuar de onde parei", { timeout: 20000 });
  say("home: continue where I stopped, review of the day (3 cards), week theme", (await p.locator("text=Revisão do dia: 3 cartões").count()) > 0 && (await p.locator("text=Tema da semana").count()) > 0 && (await p.locator("a:has-text('Continuar')").count()) > 0);

  // closing screen (reopened from the notebook)
  await p.goto(`${BASE}/fechamento?s=${sid}`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Resumo do professor", { timeout: 20000 });
  say("closing: spoken summary with the listen button", (await p.locator("button:has-text('Ouvir o resumo')").count()) > 0 && (await p.locator("text=um dos sete diáconos").count()) > 0);
  say("closing: the mind map is drawn (SVG with 4 nodes) with a text alternative", (await p.locator("svg[role=img] ellipse").count()) === 4 && (await p.locator("svg[role=img][aria-label*='Filipe']").count()) > 0);
  say("closing: the review cards are listed", (await p.locator("main li:has-text('eunuco estava lendo')").count()) > 0);

  // review
  await p.goto(`${BASE}/revisao`, { waitUntil: "networkidle" });
  await p.click("button:text('Começar a revisão')");
  await p.waitForSelector("text=Cartão 1 de 3");
  const q1 = (await p.locator("p.text-lg").first().textContent()) ?? "";
  say("review: the teacher asks the first card", /eunuco|Filipe/.test(q1));
  await p.fill("textarea", q1.includes("lendo") ? "O livro do profeta Isaías" : q1.includes("função") ? "Um dos sete que serviam às mesas" : "Para abrir a conversa e explicar o texto");
  await p.click("button:text('Responder')");
  await p.waitForSelector("[role=status] strong", { timeout: 30000 });
  const verdict = await p.locator("[role=status] strong").first().textContent();
  say(`review: graded (${verdict}) with a short reply and the next date`, /Certo|Quase|Para rever/.test(verdict ?? "") && (await p.locator("text=Volta em").count()) > 0);
  const row = await sql(`select interval_days, ease, repetitions, due_at > now() as future, last_grade from review_cards where user_id='${id}' and last_grade is not null`);
  const logs = await sql(`select count(*)::int n from review_logs where user_id='${id}'`);
  say("review: the card was rescheduled by SM-2 and logged", row.length === 1 && row[0].future === true && [1, 3, 5].includes(row[0].last_grade) && logs[0].n === 1);
  await p.click("button:text('Próximo')");
  await p.waitForSelector("text=Cartão 2 de 3");
  say("review: moves to the next card", true);

  // notebook
  await p.goto(`${BASE}/caderno`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Filipe e o eunuco etíope");
  say("notebook: the session appears with its kind", (await p.locator("main li:has-text('Sessão')").count()) > 0);
  await p.fill("input[type=search]", "eunuco");
  await p.waitForTimeout(700);
  say("notebook: search by text finds it", (await p.locator("main li").count()) === 1);
  await p.fill("input[type=search]", "zzzz");
  await p.waitForTimeout(700);
  say("notebook: a search with no match shows the empty message", (await p.locator("text=Seu caderno ainda está vazio").count()) > 0);
  await p.fill("input[type=search]", "");
  await p.click("button:text('Nova nota')");
  await p.fill("input[aria-label='Título']", "Minha dúvida sobre Atos 8");
  await p.fill("textarea", "Por que o Espírito levou Filipe ao deserto?");
  await p.click("button:text('Salvar')");
  await p.waitForSelector("text=Minha dúvida sobre Atos 8");
  say("notebook: personal note saved", true);
  const pdf = await p.evaluate(async () => {
    const token = await new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").getAll(); g.onsuccess = () => res(JSON.parse(g.result.find((x) => typeof x === "string" && x.includes("access_token"))).access_token); }; });
    const r = await fetch("/api/v1/notebook/export?id=all", { headers: { Authorization: `Bearer ${token}` } });
    const b = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get("content-type"), head: String.fromCharCode(...b.slice(0, 5)), size: b.length };
  });
  say("notebook: the whole notebook exports as a PDF", pdf.status === 200 && pdf.type === "application/pdf" && pdf.head === "%PDF-" && pdf.size > 1500);

  // offline mode: the notebook opens from the cache
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await ctx.setOffline(true);
  await p.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForSelector("text=Minha dúvida sobre Atos 8", { timeout: 20000 }).catch(() => {});
  say("offline: the notebook still opens and shows the saved items", (await p.locator("text=Minha dúvida sobre Atos 8").count()) > 0);
  await ctx.setOffline(false);
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
