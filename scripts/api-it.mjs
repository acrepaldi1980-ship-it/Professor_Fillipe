// End-to-end check of the auth/profile/consent/session/turn/delete API against a running server (default :3100).
// Creates a throwaway confirmed user directly in the database, signs in with the real Supabase Auth, and removes everything at the end.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { sql } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100/api/v1";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = `it-${Date.now()}@example.test`;
const password = `Tt!${randomUUID()}`;
let userId = null;
const results = [];
const check = (name, pass, extra = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* SSE or empty */
  }
  return { status: res.status, json, text };
}

(async () => {
  try {
    // throwaway user
    userId = randomUUID();
    await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('${userId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')`);
    const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    check("sign in with real Supabase Auth", !error && !!data.session, error?.message);
    const token = data.session.access_token;

    check("API rejects requests without a token", (await api("/me")).status === 401);
    check("API rejects a forged token", (await api("/me", { token: "abc.def.ghi" })).status === 401);

    let me = await api("/me", { token });
    check("new user must complete onboarding", me.status === 200 && me.json.onboarding.needsConsent === true && me.json.profile === null);

    check("under 13 is blocked", (await api("/me", { method: "PUT", token, body: { display_name: "Teste", birth_date: "2018-01-01" } })).status === 403);
    check("13-17 without guardian awareness is refused", (await api("/me", { method: "PUT", token, body: { display_name: "Teste", birth_date: "2010-05-05" } })).json?.error === "guardian_ack_required");
    check("invalid birth date is refused", (await api("/me", { method: "PUT", token, body: { birth_date: "31/12/1990" } })).status === 400);

    const put = await api("/me", { method: "PUT", token, body: { display_name: "Teste IT", preferred_name: "Tester", birth_date: "1985-03-02" } });
    check("adult profile saved", put.status === 200);
    for (const kind of ["terms", "privacy"]) check(`consent ${kind} recorded`, (await api("/consents", { method: "POST", token, body: { kind, granted: true } })).status === 201);
    me = await api("/me", { token });
    check("onboarding complete after consents", me.json.onboarding.needsConsent === false && me.json.profile.is_minor === false && me.json.profile.role === "student");

    // privilege escalation attempt through the profile API and directly through the database client
    await api("/me", { method: "PUT", token, body: { display_name: "x", role: "admin" } });
    const { data: direct } = await sb.from("profiles").update({ role: "admin" }).eq("user_id", userId).select("role");
    me = await api("/me", { token });
    check("user cannot become admin", me.json.profile.role === "student", `direct update returned ${JSON.stringify(direct)}`);

    const sess = await api("/sessions", { method: "POST", token, body: { mode: "free" } });
    check("session created", sess.status === 201 && !!sess.json.sessionId);
    const sessionId = sess.json.sessionId;

    check("turn without a session of its own is refused", (await api("/teacher/turn", { method: "POST", token, body: { sessionId: randomUUID(), text: "oi" } })).status === 404);

    const turn = await api("/teacher/turn", { method: "POST", token, body: { sessionId, text: "Quem foi Barnabé?" } });
    check("teacher turn streams a structured answer", turn.status === 200 && /event: structured/.test(turn.text), turn.text.slice(0, 80).replace(/\n/g, " "));
    const [{ n: saved }] = await sql(`select count(*)::int n from messages where session_id='${sessionId}'`);
    check("conversation saved in the database (2 messages)", saved === 2, `saved=${saved}`);

    const crisis = await api("/teacher/turn", { method: "POST", token, body: { sessionId, text: "Faz uma semana que meu pai morreu e não consigo parar de chorar." } });
    check("crisis is answered with CVV/SAMU", /188/.test(crisis.text) && /192/.test(crisis.text));
    const [{ n: after }] = await sql(`select count(*)::int n from messages where session_id='${sessionId}'`);
    const [{ n: ev }] = await sql(`select count(*)::int n from pastoral_events where user_id='${userId}'`);
    check("crisis text is NOT stored, only the event", after === 2 && ev === 1, `messages=${after} events=${ev}`);

    check("delete account needs confirmation", (await api("/account", { method: "DELETE", token, body: {} })).status === 400);
    const del = await api("/account", { method: "DELETE", token, body: { confirm: "EXCLUIR" } });
    check("account deletion accepted", del.status === 202);
    const [left] = await sql(`select (select count(*) from auth.users where id='${userId}')::int u, (select count(*) from profiles where user_id='${userId}')::int p, (select count(*) from sessions where user_id='${userId}')::int s, (select count(*) from consent_records where user_id='${userId}')::int c, (select count(*) from pastoral_events where user_id='${userId}')::int e`);
    check("all personal data erased (cascade)", left.u + left.p + left.s + left.c + left.e === 0, JSON.stringify(left));
    userId = null;
  } catch (e) {
    console.log("TEST ERROR:", e.message);
    results.push(false);
  } finally {
    if (userId) await sql(`delete from auth.users where id='${userId}'`).catch(() => {});
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
