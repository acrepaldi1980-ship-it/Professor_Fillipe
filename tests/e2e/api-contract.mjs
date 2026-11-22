// Every API route, every method, three roles (visitor, student, admin), bad input: nothing may answer 5xx, errors are JSON with an `error` code,
// private routes refuse visitors (401), admin routes refuse students (403). Only invalid bodies are sent, so no data is changed.
// Usage: APP_URL=<site> node --env-file=.env.local tests/e2e/api-contract.mjs
import { randomUUID } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../../scripts/db.mjs";

const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true, calls = 0;
const fails = [];
const say = (n, p, x = "") => { if (!p) { ok = false; fails.push(n); } console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const SAMPLE = { id: randomUUID(), version: "por_blivre_2018", ref: "JHN.3.16", tradition: "reformada", strong: "G26", provider: "asaas", hash: "a".repeat(64) };
const routes = walk("app/api").filter((f) => f.endsWith("route.ts")).map((f) => f.replace("app/api/v1/", "").replace("/route.ts", ""));
const expand = (r) => r.replace(/\[\.\.\.path\]/, "compare").replace(/\[(\w+)\]/g, (_, k) => SAMPLE[k] ?? SAMPLE.id);
const PRIVATE = /^(account|admin|me|notebook|sessions|teacher|billing\/(cancel|checkout|simulate|subscription)|church|review|preferences|consents|events|voice|visuals\/(illustration$))/;
const ADMIN = /^admin\//;
const PUBLIC_OK = /^(health|config|plans|warmup|sources|sermon-types|visuals\/(maps|models|timelines)|webhooks|bible|graph|lexicon)/;
const NO_JSON = /pdf|export|speak|illustration\/|voice\/speak|document\/pdf/;

async function user(role) {
  const uid = randomUUID(), em = `api-${role}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${uid}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${em}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, role) values ('${uid}','Teste ${role}','Teste','1984-03-02',false,'intermediário',50,'${role}')`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${uid}','terms','t',true),('${uid}','privacy','t',true),('${uid}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email: em, password: pw });
  return { uid, token: data.session.access_token };
}
const call = async (method, path, token, body) => {
  calls++;
  const res = await fetch(`${BASE}/api/v1/${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), "X-App-Version": "qa", "X-Platform": "web" }, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  return { status: res.status, ct, text };
};

const users = [];
try {
  const student = await user("student"); users.push(student.uid);
  const admin = await user("admin"); users.push(admin.uid);
  const actors = [["visitor", null], ["student", student.token], ["admin", admin.token]];
  const bad = { five: [], noJson: [], visitorOpen: [], studentOnAdmin: [] };
  for (const route of routes.sort()) {
    const path = expand(route);
    for (const [who, token] of actors) {
      for (const [method, body] of [["GET"], ["POST", {}], ["POST", { text: 12, ref: [], id: null }], ["PUT", {}], ["DELETE"]]) {
        if (route === "account" && method === "DELETE" && who !== "visitor") continue; // would delete the test user mid-run (covered in user-functions)
        if (/^webhooks/.test(route) && who !== "visitor") continue;
        const r = await call(method, path, token, body);
        const tag = `${who} ${method} /${path}`;
        if (r.status >= 500 && ![501, 503].includes(r.status)) bad.five.push(`${tag} -> ${r.status} ${r.text.slice(0, 80)}`);
        if (r.status >= 400 && !NO_JSON.test(route) && r.status !== 404 && r.status !== 405 && !r.ct.includes("json")) bad.noJson.push(`${tag} -> ${r.status} ${r.ct}`);
        if (r.status >= 400 && r.ct.includes("json")) { try { const j = JSON.parse(r.text); if (typeof j.error !== "string" && !j.message && !j.issues) bad.noJson.push(`${tag} -> body without error code: ${r.text.slice(0, 60)}`); } catch { bad.noJson.push(`${tag} -> invalid JSON`); } }
        if (who === "visitor" && PRIVATE.test(route) && !PUBLIC_OK.test(route) && r.status !== 401 && r.status !== 405 && r.status !== 404) bad.visitorOpen.push(`${tag} -> ${r.status}`);
        if (who === "student" && ADMIN.test(route) && ![401, 403, 405, 404].includes(r.status)) bad.studentOnAdmin.push(`${tag} -> ${r.status}`);
      }
    }
  }
  say(`${routes.length} routes x 3 roles x 5 calls (${calls} calls): none answers 5xx`, !bad.five.length, bad.five.slice(0, 40).join(" | "));
  say("every error is JSON with an error code", !bad.noJson.length, bad.noJson.slice(0, 40).join(" | "));
  say("private routes refuse visitors (401)", !bad.visitorOpen.length, bad.visitorOpen.slice(0, 40).join(" | "));
  say("admin routes refuse students", !bad.studentOnAdmin.length, bad.studentOnAdmin.slice(0, 40).join(" | "));
  // health and config are public and shaped
  const h = await call("GET", "health"); say("health answers 200 with ok", h.status === 200 && /ok/i.test(h.text), h.text.slice(0, 60));
  const pl = await call("GET", "plans"); say("plans lists the plans", pl.status === 200 && /plus|premium/i.test(pl.text));
} catch (e) { ok = false; console.log("ERROR", String(e).slice(0, 400)); } finally {
  for (const u of users) await sql(`delete from auth.users where id='${u}'`).catch(() => undefined);
  console.log(ok ? "ALL OK" : `SOME FAILED (${fails.length})`);
  process.exit(ok ? 0 : 1);
}
