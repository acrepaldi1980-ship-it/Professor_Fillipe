import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../db.mjs";
const BASE = process.env.APP_URL ?? "https://professor-filipe.vercel.app";
const uid = randomUUID(), em = `lat-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${uid}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${em}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${uid}','Lat','Lat','1984-03-02',false,'intermediário',50)`);
await sql(`insert into consent_records (user_id, kind, version, granted) values ('${uid}','terms','t',true),('${uid}','privacy','t',true),('${uid}','sensitive_religious','t',false)`);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const tok = (await sb.auth.signInWithPassword({ email: em, password: pw })).data.session.access_token;
const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "X-App-Version": "qa", "X-Platform": "web" };
try {
  let t = Date.now();
  const s = await (await fetch(`${BASE}/api/v1/sessions`, { method: "POST", headers: H, body: JSON.stringify({ mode: "free" }) })).json();
  console.log("create session ms", Date.now() - t);
  const qs = ["Quem foi Filipe em Atos 8?", "O que significa graça?", "Explique João 3:16", "Qual a diferença entre o batismo de João e o de Jesus?", "Oi"];
  for (const q of qs) {
    t = Date.now();
    const r = await fetch(`${BASE}/api/v1/teacher/turn`, { method: "POST", headers: H, body: JSON.stringify({ sessionId: s.sessionId, text: q }) });
    const first = Date.now() - t; const txt = await r.text(); const total = Date.now() - t;
    const m = txt.match(/event: (\w+)/g)?.join(",");
    const meta = txt.match(/"retrievalMs":(\d+)[^}]*?"llmMs":(\d+)/) ?? txt.match(/"llmMs":(\d+)/);
    const speech = (txt.match(/"speech":"([^"]{0,60})/) ?? [])[1];
    console.log(`turn "${q.slice(0, 30)}" status=${r.status} first-byte=${first}ms total=${total}ms events=${m} meta=${JSON.stringify(txt.match(/"retrievalMs":\d+/)?.[0])} ${JSON.stringify(txt.match(/"llmMs":\d+/)?.[0])} degraded=${/degraded":true/.test(txt)} speech="${speech}"`);
    t = Date.now();
    const sp = await fetch(`${BASE}/api/v1/voice/speak`, { method: "POST", headers: H, body: JSON.stringify({ text: "Filipe foi um dos sete escolhidos para servir em Jerusalém." }) });
    const b = await sp.arrayBuffer(); console.log(`   speak status=${sp.status} ${Date.now() - t}ms bytes=${b.byteLength}`);
  }
} finally { await sql(`delete from auth.users where id='${uid}'`).catch(() => undefined); }
