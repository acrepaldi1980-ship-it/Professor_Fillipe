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
const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
try {
  const s = await (await fetch(`${BASE}/api/v1/sessions`, { method: "POST", headers: H, body: JSON.stringify({ mode: "free" }) })).json();
  for (const q of ["Quem foi Filipe em Atos 8?", "O que Filipe perguntou ao eunuco?", "Por que isso importa para mim hoje?"]) {
    const t = Date.now();
    const txt = await (await fetch(`${BASE}/api/v1/teacher/turn`, { method: "POST", headers: H, body: JSON.stringify({ sessionId: s.sessionId, text: q }) })).text();
    const done = txt.split("\n\n").find((b) => b.startsWith("event: done"))?.replace(/^event: done\ndata: /, "") ?? "";
    const m = JSON.parse(done || "{}");
    console.log(`${Date.now() - t}ms turn "${q.slice(0, 30)}" degraded=${m.degraded ?? false}`);
  }
  const t = Date.now();
  const r = await fetch(`${BASE}/api/v1/sessions/${s.sessionId}/close`, { method: "POST", headers: H });
  console.log(`close ${r.status} ${Date.now() - t}ms`, (await r.text()).slice(0, 200));
  console.log("cards in the database:", JSON.stringify(await sql(`select question, ref from review_cards where user_id='${uid}'`)));
} finally { await sql(`delete from auth.users where id='${uid}'`).catch(() => undefined); }
