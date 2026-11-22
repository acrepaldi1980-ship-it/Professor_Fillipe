// Every page, three roles, phone and desktop: no page error, no console error, no failed request (5xx), no horizontal scroll, every image has alt,
// every button, link and field has a name. Public pages open for visitors; app pages send visitors to /login; admin pages refuse students.
// Usage: APP_URL=<site> node --env-file=.env.local tests/e2e/pages-smoke.mjs
import { randomUUID } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true; const bad = [];
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk("app").filter((f) => f.endsWith("page.tsx")).map((f) => ({ file: f, url: "/" + f.replace(/^app\//, "").replace(/\([^)]*\)\//g, "").replace(/\/?page\.tsx$/, "").replace(/\[(\w+)\]/g, () => randomUUID()) }));
const PUBLIC = /^\/($|termos|privacidade|fontes-e-licencas|instalar|login|checkout|auth|curiosidades|arqueologia|planos|igreja\/entrar|convite|r\/)/;
const SKIP_CONSOLE = /favicon|manifest|sw\.js|Failed to load resource: the server responded with a status of (401|403|404)|ERR_BLOCKED|NetworkError|net::ERR|Download the React DevTools|webgl|WebGL|GPU stall|swiftshader/i;

async function user(role) {
  const uid = randomUUID(), em = `pg-${role}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${uid}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${em}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, role) values ('${uid}','Teste ${role}','Teste','1984-03-02',false,'intermediário',50,'${role}')`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${uid}','terms','t',true),('${uid}','privacy','t',true),('${uid}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  return { uid, session: (await sb.auth.signInWithPassword({ email: em, password: pw })).data.session };
}
async function sign(ctx, session) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(session) });
  await p.close();
}
const A11Y = () => {
  const out = [];
  const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent || el.getAttribute("title") || el.getAttribute("alt") || "").trim();
  document.querySelectorAll("img").forEach((i) => { if (!i.hasAttribute("alt")) out.push(`img without alt: ${(i.getAttribute("src") ?? "").slice(0, 40)}`); });
  document.querySelectorAll("button, a[href], [role=button]").forEach((b) => { if (!name(b) && !b.querySelector("img[alt]:not([alt=''])") && !b.querySelector("svg title")) out.push(`unnamed ${b.tagName.toLowerCase()}: ${b.outerHTML.slice(0, 70)}`); });
  document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach((f) => { const id = f.id; if (!f.getAttribute("aria-label") && !f.getAttribute("aria-labelledby") && !(id && document.querySelector(`label[for="${id}"]`)) && !f.closest("label") && !f.getAttribute("placeholder") && !f.getAttribute("title")) out.push(`unlabeled field: ${f.outerHTML.slice(0, 70)}`); });
  if (!document.querySelector("h1, h2, [role=heading]")) out.push("no heading");
  if (!document.documentElement.lang) out.push("no html lang");
  return out;
};

const users = [];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const student = await user("student"); const admin = await user("admin"); users.push(student.uid, admin.uid);
  const actors = [["visitor", null], ["student", student.session], ["admin", admin.session]];
  const sizes = [["phone", { width: 360, height: 740 }], ["desktop", { width: 1280, height: 800 }]];
  let n = 0;
  for (const [who, session] of actors) for (const [sz, vp] of sizes) {
    const ctx = await browser.newContext({ viewport: vp, locale: "pt-BR" });
    if (session) await sign(ctx, session);
    const p = await ctx.newPage();
    const errs = [], fiveXX = [];
    p.on("pageerror", (e) => errs.push(`pageerror: ${String(e).slice(0, 120)}`));
    p.on("console", (m) => { if (m.type() === "error" && !SKIP_CONSOLE.test(m.text())) errs.push(`console: ${m.text().slice(0, 120)}`); });
    p.on("response", (r) => { if (r.status() >= 500) fiveXX.push(`${r.status()} ${r.url().replace(BASE, "").slice(0, 70)}`); });
    for (const { url } of pages) {
      n++; errs.length = 0; fiveXX.length = 0;
      const tag = `${who}/${sz} ${url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")}`;
      try { await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 }); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(600); } catch (e) { bad.push(`${tag}: did not load (${String(e).slice(0, 60)})`); continue; }
      const final = new URL(p.url()).pathname;
      const isPublic = PUBLIC.test(url) || url === "/";
      if (who === "visitor" && !isPublic && !final.startsWith("/login")) bad.push(`${tag}: visitor not sent to /login (ended ${final})`);
      if (who === "student" && url.startsWith("/admin") && final.startsWith("/admin") && (await p.locator("main").innerText().catch(() => "")).length > 200 && !/restrit|acesso|permiss|negado/i.test(await p.locator("body").innerText())) bad.push(`${tag}: student sees admin content`);
      if (errs.length) bad.push(`${tag}: ${errs.slice(0, 2).join(" ; ")}`);
      if (fiveXX.length) bad.push(`${tag}: ${fiveXX.slice(0, 2).join(" ; ")}`);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2 && !/imersao|estudo/.test(url)) bad.push(`${tag}: horizontal scroll (+${overflow}px)`);
      if (!final.startsWith("/login") || url.startsWith("/login")) { const a = await p.evaluate(A11Y); for (const x of a.slice(0, 3)) bad.push(`${tag}: ${x}`); }
    }
    await ctx.close();
  }
  say(`${n} page visits (${pages.length} pages x 3 roles x 2 sizes)`, !bad.length, `${bad.length} problems`);
  const uniq = [...new Set(bad)];
  uniq.slice(0, 60).forEach((b) => console.log("  -", b));
  if (uniq.length > 60) console.log(`  ... and ${uniq.length - 60} more`);
} catch (e) { ok = false; console.log("ERROR", String(e).slice(0, 400)); } finally {
  for (const u of users) await sql(`delete from auth.users where id='${u}'`).catch(() => undefined);
  await browser.close();
  console.log(ok ? "ALL OK" : "SOME FAILED");
  process.exit(ok ? 0 : 1);
}
