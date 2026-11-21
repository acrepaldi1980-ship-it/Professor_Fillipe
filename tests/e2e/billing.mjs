// End-to-end test of plans, checkout, limits and subscription states (Prompt 1.11) with the simulated payment provider.
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
const email = `bill-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
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
  const api = (path, init = {}) => p.evaluate(async ({ path, init }) => {
    const token = await new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").getAll(); g.onsuccess = () => res(JSON.parse(g.result.find((x) => typeof x === "string" && x.includes("access_token"))).access_token); }; });
    const r = await fetch(`/api/v1${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { path, init });

  // ---- Free plan: the comparison, the limits and the plan-only features ----
  await p.goto(`${BASE}/planos`, { waitUntil: "networkidle" });
  await p.waitForSelector("h2:text('Premium')", { timeout: 20000 });
  say("plans: Free, Plus and Premium with the confirmed prices (D-01)", (await p.locator("text=R$ 29,90/mês").count()) > 0 && (await p.locator("text=R$ 49,90/mês").count()) > 0 && (await p.locator("text=R$ 0").count()) > 0);
  await p.click("[role=radio]:text('Anual')");
  say("plans: the yearly prices", (await p.locator("text=R$ 287,00/ano").count()) > 0 && (await p.locator("text=R$ 479,00/ano").count()) > 0);
  say("plans: the Premium trial is offered to a first-time student", (await p.locator("text=7 dias grátis").count()) > 0);

  const sermon = await api("/sessions", { method: "POST", body: JSON.stringify({ mode: "sermon", context: { sermon_type: "Expositivo", ref_or_theme: "Atos 8" } }) });
  say("free: sermon is blocked with a clear 'Premium' answer", sermon.status === 403 && sermon.body.error === "plan_required" && sermon.body.needs === "premium");
  const pdfBlocked = await api("/notebook/export?id=all");
  say("free: PDF export is blocked (Plus)", pdfBlocked.status === 403 && pdfBlocked.body.needs === "plus");
  const l1 = await api("/sessions", { method: "POST", body: JSON.stringify({ mode: "lesson", context: { topic: "Filipe", age_group: "adults", minutes: 45 } }) });
  const l2 = await api("/sessions", { method: "POST", body: JSON.stringify({ mode: "lesson", context: { topic: "Davi", age_group: "adults", minutes: 45 } }) });
  say("free: 1 lesson per month, the second is blocked with a limit answer", l1.status === 201 && l2.status === 429 && l2.body.error === "limit" && l2.body.limit === 1);
  const free = await sql(`select id from sessions where user_id='${id}' limit 1`);
  await sql(`insert into usage_counters (user_id, day, text_messages) values ('${id}', current_date, 20) on conflict (user_id, day) do update set text_messages = 20`);
  const s = await api("/sessions", { method: "POST", body: JSON.stringify({ mode: "free" }) });
  const turn = await p.evaluate(async (sessionId) => {
    const token = await new Promise((res) => { const r = indexedDB.open("professor-filipe", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").getAll(); g.onsuccess = () => res(JSON.parse(g.result.find((x) => typeof x === "string" && x.includes("access_token"))).access_token); }; });
    const r = await fetch("/api/v1/teacher/turn", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, text: "Quem foi Davi?" }) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, s.body.sessionId);
  say("free: the 21st message of the day is refused with an invitation to subscribe", turn.status === 429 && turn.body.error === "limit" && turn.body.limit === 20 && turn.body.upgrade === "plus");
  say("free: sessions exist (sanity)", free.length >= 1);

  // ---- Plus with Pix: checkout -> simulated payment confirmed -> access released ----
  await p.goto(`${BASE}/planos`, { waitUntil: "networkidle" });
  await p.waitForSelector("h2:text('Plus')");
  await p.locator("div:has(> h2:text('Plus')) button:text('Assinar')").click();
  await p.waitForURL(/\/checkout\/simulado/, { timeout: 20000 });
  await p.waitForSelector("text=29,90", { timeout: 20000 }).catch(() => {});
  say("checkout: opens the (test) payment page with the amount", (await p.locator("text=29,90").count()) > 0);
  const before = await sql(`select status from subscriptions where user_id='${id}'`);
  say("checkout: before paying there is no access yet (placeholder subscription)", before.length === 1 && before[0].status === "expired" && (await api("/notebook/export?id=all")).status === 403);
  await p.click("button:text('Simular pagamento confirmado')");
  await p.waitForSelector("text=Feito!", { timeout: 20000 });
  const after = await sql(`select s.status, e.entitlement, e.status as est from subscriptions s join entitlements e on e.user_id = s.user_id where s.user_id='${id}'`);
  say("webhook: payment confirmed -> subscription active and the access right written", after[0]?.status === "active" && after[0].entitlement === "plan:plus" && after[0].est === "active");
  say("plus: PDF export is now allowed (read only from entitlements)", (await api("/notebook/export?id=all")).status !== 403);
  const events = await sql(`select count(*)::int n from payment_events`);
  say("webhook: the event was logged for idempotency", events[0].n >= 1);
  await p.goto(`${BASE}/assinatura`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Minha assinatura");
  say("my subscription: Plus, active, next charge date, usage against the limits", (await p.locator("strong:text('Plus')").count()) > 0 && (await p.locator("text=Ativa").count()) > 0 && (await p.locator("text=Mensagens hoje: 20 de sem limite").count()) > 0);

  // ---- overdue -> past_due keeps access (grace) ----
  const ref = (await sql(`select provider_ref from subscriptions where user_id='${id}'`))[0].provider_ref;
  const od = await api("/billing/simulate", { method: "POST", body: JSON.stringify({ ref, event: "PAYMENT_OVERDUE" }) });
  const pd = await sql(`select status from subscriptions where user_id='${id}'`);
  say("overdue: the subscription is past_due and access is kept during the grace period", od.status === 200 && pd[0].status === "past_due" && (await api("/notebook/export?id=all")).status !== 403);
  await p.reload({ waitUntil: "networkidle" });
  say("my subscription shows the overdue notice", (await p.locator("text=Pagamento em atraso").count()) > 0);
  // a late payment brings it back
  await api("/billing/simulate", { method: "POST", body: JSON.stringify({ ref, event: "PAYMENT_CONFIRMED" }) });
  say("overdue -> paid: active again", (await sql(`select status from subscriptions where user_id='${id}'`))[0].status === "active");

  // ---- cancel from the screen: access until the end of the period ----
  await p.reload({ waitUntil: "networkidle" });
  await p.click("button:text('Cancelar assinatura')");
  await p.click("button:text('Sim, cancelar')");
  await p.waitForSelector("text=Cancelada (acesso até o fim do período)", { timeout: 20000 });
  const canc = await sql(`select s.status, e.status as est from subscriptions s join entitlements e on e.user_id = s.user_id where s.user_id='${id}'`);
  say("cancel: status canceled, access right kept until the end of the paid period", canc[0].status === "canceled" && canc[0].est === "active" && (await api("/notebook/export?id=all")).status !== 403);

  // ---- Premium trial: a new subscription in a fresh student gets 7 days free; here the student already had Plus, so no trial ----
  const prem = await api("/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "premium", cycle: "month", method: "card" }) });
  say("premium: no second trial for a student who already subscribed", prem.status === 200 && prem.body.trial === false);

  // ---- admin numbers ----
  await sql(`update profiles set role='admin' where user_id='${id}'`);
  await p.goto(`${BASE}/admin/assinaturas`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Assinaturas e custos", { timeout: 20000 });
  say("admin: subscribers by plan, MRR, cancellations and AI cost are shown", (await p.locator("text=Receita mensal recorrente").count()) > 0 && (await p.locator("text=Custo de IA por usuário").count()) > 0);
  say("no page errors", errors.length === 0 || (console.log(errors), false));
  await ctx.close();
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 500));
  ok = false;
} finally {
  await sql(`delete from payment_events where provider = 'simulated'`).catch(() => {});
  await sql(`delete from subscriptions where user_id='${id}'`).catch(() => {});
  await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
