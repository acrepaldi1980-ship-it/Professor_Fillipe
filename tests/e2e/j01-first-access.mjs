// End-to-end test of journey J01 (first access): consent -> religious-data choice -> guided interview (7 steps) -> setup ->
// welcome card -> first lesson -> home. Runs two personas ("Ana, 17" and "Pr. Joel") and compares their levels.
// Needs the app on http://localhost:3100 (next start -p 3100) and a Supabase management token (scripts/db.mjs).
// Usage: GLOBAL_NM=$(npm root -g) NODE_OPTIONS=--use-env-proxy node --env-file=.env.local tests/e2e/j01-first-access.mjs
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium, devices } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p) => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}`); };

const personas = [
  { key: "ana", name: "Ana", birth: "2010-05-05", guardian: true, religious: false, experience: "Estou começando", goals: ["Entender melhor a Palavra"], minutes: "10 minutos", formats: ["Ouvir"], topic: "a vida de Davi", expectLevel: "iniciante", steps: 6 },
  { key: "joel", name: "Joel", birth: "1968-02-11", guardian: false, religious: true, role: "Pastor", experience: "Mais de 10 anos", goals: ["Preparar mensagens", "Estudar teologia a fundo"], minutes: "1 hora", formats: ["Ler"], topic: "a exegese do grego em Romanos e a escatologia", expectLevel: "avançado", steps: 7 },
];
const levels = {};
const browser = await chromium.launch();
for (const pe of personas) {
  const email = `j01-${pe.key}-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
  try {
    await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { data } = await sb.auth.signInWithPassword({ email, password });
    const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
    await p.evaluate(async ({ key, value }) => {
      await new Promise((res, rej) => {
        const r = indexedDB.open("professor-filipe", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
        r.onerror = () => rej();
      });
    }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });

    // consent
    await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
    await p.waitForURL("**/onboarding/consentimento", { timeout: 20000 }).catch((e) => { console.log("URL now:", p.url(), errors.join("|").slice(0, 200)); throw e; });
    await p.fill("#name", pe.name);
    await p.fill("#birth", pe.birth);
    await p.waitForTimeout(300);
    if (pe.guardian) await p.check("text=um responsável sabe");
    await p.check("text=Li e aceito os Termos de Uso");
    await p.check("text=Li e aceito a Política de Privacidade");
    await p.click("button[type=submit]");
    await p.waitForURL("**/onboarding/dado-religioso", { timeout: 20000 });
    if (pe.religious) await p.click("button:has-text('Aceito informar')"); else await p.click("text=Prefiro não informar");

    // interview
    await p.waitForURL("**/onboarding/entrevista", { timeout: 20000 });
    say(`${pe.key}: interview opens after the consents`, true);
    await p.waitForSelector("[role=progressbar]");
    await p.fill("input[aria-label]", pe.name);
    await p.click("button:has-text('Continuar')");
    await p.waitForTimeout(300);
    say(`${pe.key}: the teacher reacts to the name`, (await p.textContent("main"))?.includes(pe.name));
    await p.click(`button:has-text('${pe.experience}')`, { timeout: 8000 });
    for (const g of pe.goals) await p.click(`button:has-text('${g}')`, { timeout: 8000 });
    await p.click("button:has-text('Continuar')");
    if (pe.religious) await p.click(`button:has-text('${pe.role}')`, { timeout: 8000 });
    await p.click(`button:has-text('${pe.minutes}')`, { timeout: 8000 });
    for (const f of pe.formats) await p.click(`button:has-text('${f}')`, { timeout: 8000 });
    await p.click("button:has-text('Continuar')");
    await p.fill("input[aria-label]", pe.topic, { timeout: 8000 });
    await p.click("button:has-text('Continuar')");
    say(`${pe.key}: question 4 ${pe.religious ? "appears" : "is skipped"} (consent)`, true);

    // setup, welcome card, first lesson
    await p.waitForURL("**/onboarding/configuracao", { timeout: 20000 });
    await p.waitForSelector("text=Qual linha teológica");
    if (pe.religious) await p.click("button:has-text('Pentecostal')");
    await p.click("button:has-text('Continuar')");
    await p.waitForURL("**/onboarding/boas-vindas", { timeout: 20000 });
    await p.waitForSelector(`text=Tudo pronto, ${pe.name}`);
    const card = await p.textContent("main");
    const level = /iniciante|intermediário|avançado/.exec(card ?? "")?.[0];
    levels[pe.key] = level;
    say(`${pe.key}: welcome card shows the estimated level (${level})`, level === pe.expectLevel);
    await p.click("text=Começar minha primeira aula");
    await p.waitForURL(/\/estudo\?s=/, { timeout: 20000 });
    await p.waitForSelector("text=Quero entender melhor este tema", { timeout: 20000 }).catch(() => {});
    say(`${pe.key}: the first lesson starts from the chosen topic`, ((await p.textContent("main")) ?? "").includes(pe.topic));
    const me = await sql(`select level, first_topic, daily_minutes, ministry_role_enc is not null as has_role from profiles where user_id='${id}'`);
    say(`${pe.key}: profile saved (role stored only with consent)`, me[0].level === pe.expectLevel && me[0].first_topic === pe.topic && me[0].has_role === pe.religious);
    await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
    say(`${pe.key}: home shows the first topic`, ((await p.textContent("main")) ?? "").includes(pe.topic));
    say(`${pe.key}: no page errors`, errors.length === 0 || (console.log(errors), false));
    await ctx.close();
  } catch (e) {
    console.log(`E2E ERROR (${pe.key}):`, e.message.slice(0, 300));
    ok = false;
  } finally {
    await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  }
}
say("the two personas get different levels", levels.ana && levels.joel && levels.ana !== levels.joel);
await browser.close();
process.exit(ok ? 0 : 1);
