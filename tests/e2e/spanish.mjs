// Spanish end to end (Prompt 2.7, RNF-10): the profile language, the interface in Spanish on a new device, switching back, the teacher's prompt
// (Spanish layer, Reina-Valera 1909 as the default version), the document written in Spanish and the Spanish Bible versions served by the API.
// Needs the mock AI server (tests/e2e/mock-llm.mjs on 4010) so the prompt the teacher receives can be inspected.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
const MOCK = process.env.MOCK_URL ?? "http://127.0.0.1:4010";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const made = [];
async function user(label) {
  const id = randomUUID(), email = `es-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  await sql(`insert into entitlements (user_id, entitlement, source) values ('${id}','plan:premium','admin')`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, session: data.session, token: data.session.access_token };
  u.call = async (method, path, body) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return u;
}
const lastSystem = async () => (await (await fetch(`${MOCK}/stats`)).json()).lastSystem ?? "";
const turn = async (u, text) => { const s = (await u.call("POST", "/sessions", { mode: "free" })).body.sessionId; const r = await fetch(`${BASE}/api/v1/teacher/turn`, { method: "POST", headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: s, text }) }); await r.text(); return s; };

const browser = await chromium.launch();
try {
  const a = await user("ana"), b = await user("beto");
  // profile language
  say("profile: a language other than pt-BR and es is refused (400)", (await a.call("PUT", "/me", { locale: "fr" })).status === 400);
  say("profile: Spanish is saved on the profile", (await a.call("PUT", "/me", { locale: "es" })).status === 200 && (await sql(`select locale from profiles where user_id='${a.id}'`))[0].locale === "es");
  // the teacher
  await turn(a, "¿Quién fue David?");
  const sysEs = await lastSystem();
  say("teacher: a Spanish-speaking student gets the Spanish layer", sysEs.includes("IDIOMA: este aluno estuda em ESPANHOL"));
  say("teacher: the default Bible version is the Reina-Valera 1909", sysEs.includes("Reina-Valera 1909"));
  say("teacher: every rule of the character is still there (identity layer)", sysEs.includes("Você é o Professor Filipe") && sysEs.includes("nunca diga que é humano"));
  await turn(b, "Quem foi Davi?");
  const sysPt = await lastSystem();
  say("teacher: a Portuguese-speaking student gets no Spanish layer and Bíblia Livre", !sysPt.includes("ESPANHOL") && sysPt.includes("Bíblia Livre"));
  // Spanish Bible versions through the API
  const v = await a.call("GET", "/bible/spa_rv_1909/JHN.3.16");
  say("bible: the Reina-Valera 1909 serves John 3:16 in Spanish", v.status === 200 && /Porque|amó/.test(JSON.stringify(v.body)), JSON.stringify(v.body).slice(0, 120));
  const v2 = await a.call("GET", "/bible/spa_sencillo_2026/JHN.3.16");
  say("bible: a modern open Spanish version is also available", v2.status === 200 && JSON.stringify(v2.body).length > 60);
  // document in Spanish: build a section and see the instruction reach the AI
  const ds = (await a.call("POST", "/sessions", { mode: "lesson", context: { age_group: "adults", minutes: 45, topic: "La fe" } })).body.sessionId;
  const sg = await a.call("POST", `/sessions/${ds}/document/suggest`, { section: "objective" }); console.log("suggest:", sg.status, JSON.stringify(sg.body).slice(0, 150));
  const sysDoc = await (await fetch(`${MOCK}/stats`)).json();
  say("documents: the section is asked in Spanish for a Spanish-speaking student", String(sysDoc.lastSystem).includes("espanhol latino-americano"));

  // the interface on a new device (no saved language): the profile decides
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "es-MX" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(a.session) });
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForFunction(() => document.body.innerText.includes("Hola"), null, { timeout: 20000 }).catch(() => undefined);
  const home = await p.locator("body").innerText();
  say("interface: on a new device the saved profile language puts the home in Spanish", /Hola/.test(home) && /Empezar a estudiar/.test(home), home.slice(0, 90).replace(/\n/g, " | "));
  say("interface: the page language attribute follows", (await p.evaluate(() => document.documentElement.lang)) === "es");
  await p.goto(`${BASE}/conta`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-testid=language-card]", { timeout: 15000 });
  const acc = await p.locator("body").innerText();
  say("interface: the account screen is in Spanish, with the language switch and the note about content still in Portuguese", /Idioma/.test(acc) && /Cuenta/.test(acc) && /rutas, los mapas y los modelos 3D siguen en portugués/.test(acc));
  await p.getByRole("button", { name: "Português (Brasil)" }).click();
  await p.waitForFunction(() => document.body.innerText.includes("Idioma") && document.documentElement.lang === "pt-BR", null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  say("interface: switching to Portuguese changes the screen and the profile", /Aparência/.test(await p.locator("body").innerText()) && (await sql(`select locale from profiles where user_id='${a.id}'`))[0].locale === "pt-BR");
  await p.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  say("interface: it stays in Portuguese after reload (no reload loop)", /Olá/.test(await p.locator("body").innerText()));
  say("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
