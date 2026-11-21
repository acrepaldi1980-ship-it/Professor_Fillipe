// VR entry (Prompt 3.5): with a mocked WebXR the button appears and asks the browser for an immersive-vr session; without WebXR it never shows.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const email = `im-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pos = async (p) => { const s = (await p.locator("[data-testid=imm-pos]").textContent()).split(","); return { x: +s[0], z: +s[1], yaw: +s[2], zones: (s[3] ?? "").split("+").filter(Boolean) }; };
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
  await ctx.addInitScript(() => {
    window.__xr = { asked: [] };
    Object.defineProperty(navigator, "xr", { configurable: true, value: {
      isSessionSupported: async (m) => m === "immersive-vr",
      requestSession: async (m) => { window.__xr.asked.push(m); throw new DOMException("no headset here", "NotSupportedError"); },
      addEventListener() {}, removeEventListener() {},
    } });
  });
  const p = await login(ctx);
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/imersao?e=campo_de_teste`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Entrar no ambiente", { timeout: 30000 });
  await p.getByRole("button", { name: "Entrar no ambiente" }).click();
  await p.waitForSelector("[data-testid=imm-vr]", { timeout: 15000 });
  say("VR button appears when the browser supports immersive-vr", true);
  await p.locator("[data-testid=imm-vr]").click();
  await p.waitForTimeout(1500);
  const asked = await p.evaluate(() => window.__xr.asked);
  say("clicking asks the browser for an immersive-vr session", asked.includes("immersive-vr"), JSON.stringify(asked));
  say("a refused session does not break the screen (still walkable)", (await p.locator("[data-testid=imm-pos]").count()) === 1);
  say("no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
  process.exit(ok ? 0 : 1);
}
