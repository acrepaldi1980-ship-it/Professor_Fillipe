// Remote mode: asks the questions to a running deployment (real Claude, real database) as throwaway users.
// Needs the Supabase management token (scripts/db.mjs) to create and delete the users. Users are removed by close().
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { sql } from "../../scripts/db.mjs";
import type { TeacherResponse } from "../../lib/teacher/schema";

const BASE = process.env.BASE_URL ?? "https://professor-filipe.vercel.app/api/v1";
const PER_USER = 30; // the daily cap is 40 answers per student

interface Session { id: string; headers: Record<string, string>; sessionId: string; used: number }
let current: Session | null = null;
const created: string[] = [];

async function newUser(): Promise<Session> {
  const email = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  created.push(id);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const headers = { Authorization: `Bearer ${data.session!.access_token}`, "Content-Type": "application/json" };
  await fetch(`${BASE}/me`, { method: "PUT", headers, body: JSON.stringify({ display_name: "Ana", preferred_name: "Ana", birth_date: "1985-03-02" }) });
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','sensitive_religious','eval',true)`);
  const sess = (await (await fetch(`${BASE}/sessions`, { method: "POST", headers, body: JSON.stringify({ mode: "free" }) })).json()) as { sessionId: string };
  return { id, headers, sessionId: sess.sessionId, used: 0 };
}

export async function remoteTurn(text: string, level: string, lens?: string): Promise<{ response: TeacherResponse; meta: Record<string, unknown> }> {
  if (!current || current.used >= PER_USER) current = await newUser();
  current.used++;
  await sql(`update profiles set level='${level}' where user_id='${current.id}'`);
  // Through the API, so the deployment encrypts with its own key (a locally encrypted value could not be read there).
  await fetch(`${BASE}/preferences`, { method: "PUT", headers: current.headers, body: JSON.stringify({ lenses: lens ? [lens] : [] }) });
  // Every case is a fresh conversation: sharing a session made the teacher notice "repeated" questions across unrelated cases.
  const sess = (await (await fetch(`${BASE}/sessions`, { method: "POST", headers: current.headers, body: JSON.stringify({ mode: "free" }) })).json()) as { sessionId: string };
  const res = await fetch(`${BASE}/teacher/turn`, { method: "POST", headers: current.headers, body: JSON.stringify({ sessionId: sess.sessionId, text }) });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  const body = await res.text();
  const structured = /event: structured\ndata: (.+)/.exec(body)?.[1];
  const done = /event: done\ndata: (.+)/.exec(body)?.[1];
  if (!structured) throw new Error(`turn_failed ${/event: error\ndata: (.+)/.exec(body)?.[1] ?? ""}`.slice(0, 200));
  return { response: JSON.parse(structured), meta: done ? JSON.parse(done) : {} };
}

export async function closeRemote() {
  for (const id of created) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
}
