// Noah's Ark (Prompt 3.2): listed, entered, stations walked through on the three decks (floor changes), no page errors.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";

const say = (n, p, x = "") => { console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const email = `ark-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
async function login(ctx) {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${password}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(data.session) });
  return p;
}
try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, locale: "pt-BR" });
  const p = await login(ctx);
  p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  p.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url().slice(0, 120)); }); p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`${BASE}/imersao`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("text=A Arca de Noé", { timeout: 40000 }); say("list: the Ark is offered", true);
  await p.goto(`${BASE}/imersao?e=arca_de_noe`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("text=Entrar no ambiente", { timeout: 40000 });
  await p.getByRole("button", { name: "Entrar no ambiente" }).click();
  await p.waitForSelector("[data-testid=imm-pos]", { state: "attached", timeout: 30000 });
  const ys = new Set();
  for (let i = 0; i < 14; i++) {
    await p.getByTestId("imm-next").click({ timeout: 15000 }).catch(() => undefined); await p.waitForTimeout(1500);
    const pos = (await p.getByTestId("imm-pos").textContent().catch(() => "")) ?? ""; ys.add(pos.split(",")[1]);
  }
  say("stations: walked through without leaving the world", ys.size > 3, [...ys].join(" "));
  say("no page errors", errs.length === 0, errs.join(" | "));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); } finally { await sql(`delete from auth.users where id='${id}'`).catch(() => undefined); await browser.close(); process.exit(0); }
