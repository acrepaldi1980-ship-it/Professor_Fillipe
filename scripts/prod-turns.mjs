// Asks real questions against a running deployment as a throwaway user and prints speech + metrics.
// Usage: BASE_URL=https://... node scripts/prod-turns.mjs "pergunta 1" "pergunta 2"
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { sql } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/api/v1";
const email = `pt-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const questions = process.argv.slice(2);
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const token = data.session.access_token;
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  await fetch(`${BASE}/me`, { method: "PUT", headers: H, body: JSON.stringify({ display_name: "Teste", preferred_name: "Teste", birth_date: "1985-03-02" }) });
  const sess = await (await fetch(`${BASE}/sessions`, { method: "POST", headers: H, body: JSON.stringify({ mode: "free" }) })).json();
  for (const q of questions) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/teacher/turn`, { method: "POST", headers: H, body: JSON.stringify({ sessionId: sess.sessionId, text: q }) });
    const text = await res.text();
    const s = /event: structured\ndata: (.+)/.exec(text)?.[1];
    const d = /event: done\ndata: (.+)/.exec(text)?.[1];
    const e = /event: error\ndata: (.+)/.exec(text)?.[1];
    console.log(`\n# ${q}  (${Math.round((Date.now() - t0) / 100) / 10}s)`);
    if (s) { const r = JSON.parse(s); console.log("FALA:", r.speech, "\nCITACOES:", r.citations.length); }
    if (d) { const m = JSON.parse(d); console.log("META:", JSON.stringify({ retrievedChunks: m.retrievedChunks, retrievalMs: m.retrievalMs, llmMs: m.llmMs, words: m.words, degraded: m.degraded ?? false, llm: m.llm, rewrites: m.speechRewrites, retries: m.schemaRetries, reason: m.degradedReason, removedCitations: m.removedCitations })); }
    if (e) console.log("ERRO:", e);
  }
} catch (err) { console.log("ERROR", err.message); }
finally { await sql(`delete from auth.users where id='${id}'`).catch(() => {}); process.exit(0); }
