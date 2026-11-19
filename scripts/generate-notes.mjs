// Generates the Acts notes as drafts on a running deployment, as a throwaway admin user (removed at the end).
// Usage: BASE_URL=https://.../api/v1 node --env-file=.env.local scripts/generate-notes.mjs [from] [count]
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { sql } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "https://professor-filipe.vercel.app/api/v1";
const from = Number(process.argv[2] ?? 0), count = Number(process.argv[3] ?? 999);
const { ACTS_PLAN } = await import("../lib/notes/acts.ts");
const email = `notes-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const H = { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };
  await fetch(`${BASE}/me`, { method: "PUT", headers: H, body: JSON.stringify({ display_name: "Notas", preferred_name: "Notas", birth_date: "1985-03-02" }) });
  await sql(`update profiles set role='admin' where user_id='${id}'`);
  for (const [i, req] of ACTS_PLAN.slice(from, from + count).entries()) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/admin/notes/generate`, { method: "POST", headers: H, body: JSON.stringify(req) });
    const body = await res.text();
    console.log(`${from + i} ${req.title} -> ${res.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${body.slice(0, 160)}`);
  }
} finally {
  await sql(`delete from auth.users where id='${id}'`);
}
