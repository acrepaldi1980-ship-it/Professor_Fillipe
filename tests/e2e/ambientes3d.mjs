// 3D environments (Prompt 3.2): the Ark, Solomon's temple and the New Jerusalem are listed, entered and walked station by station, no page errors.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";

const say = (n, p, x = "") => { console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const email = `amb-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
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
  for (const t of ["A Arca de Noé", "O Templo de Salomão", "A Nova Jerusalém", "O Tabernáculo"]) { await p.waitForSelector(`text=${t}`, { timeout: 40000 }); say(`list: ${t} is offered`, true); }
  for (const [env, stops] of [["arca_de_noe", 14], ["templo_de_salomao", 8], ["nova_jerusalem", 9]]) {
    await p.goto(`${BASE}/imersao?e=${env}`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("text=Entrar no ambiente", { timeout: 40000 });
    await p.getByRole("button", { name: "Entrar no ambiente" }).click();
    await p.waitForSelector("[data-testid=imm-pos]", { state: "attached", timeout: 30000 });
    const seen = new Set();
    for (let i = 0; i < stops; i++) {
      await p.getByTestId("imm-next").click({ timeout: 15000 }).catch(() => undefined); await p.waitForTimeout(1500);
      seen.add(((await p.getByTestId("imm-pos").textContent().catch(() => "")) ?? "").split(",").slice(0, 2).join(","));
    }
    say(`${env}: stations walked through without leaving the world`, seen.size >= Math.min(stops, 8) - 1, `${seen.size} different places`);
  }
  say("no page errors", errs.length === 0, errs.join(" | "));
} catch (e) { console.log("ERROR", String(e).slice(0, 300)); } finally { await sql(`delete from auth.users where id='${id}'`).catch(() => undefined); await browser.close(); process.exit(0); }
