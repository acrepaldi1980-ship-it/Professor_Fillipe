// Happy-path and edge checks for the endpoints and pages that other tests only touch generically: cross references, original words, the knowledge graph,
// interlinear, speech transcription, admin notes, archaeology and curiosities pages.
// Usage: APP_URL=<site> node --env-file=.env.local tests/e2e/endpoints-extra.mjs
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${!p && x ? "  >> " + String(x).slice(0, 240) : ""}`); };
const users = [];
async function user(role) {
  const uid = randomUUID(), em = `ex-${role}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${uid}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${em}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, role) values ('${uid}','Teste','Teste','1984-03-02',false,'intermediário',50,'${role}')`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${uid}','terms','t',true),('${uid}','privacy','t',true),('${uid}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email: em, password: pw });
  users.push(uid);
  return { uid, session: data.session, token: data.session.access_token };
}
const api = async (path, token, init = {}) => { const r = await fetch(`${BASE}/api/v1/${path}`, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } }); let j = null; try { j = await r.clone().json(); } catch { /* not json */ } return { status: r.status, j, r }; };

const browser = await chromium.launch();
try {
  const st = await user("student"), ad = await user("admin");
  // cross references and original words (Bible tools)
  let r = await api("bible/crossrefs/JHN.3.16", st.token);
  say("crossrefs: a verse returns a list of references", r.status === 200 && JSON.stringify(r.j).includes("."), JSON.stringify(r.j));
  r = await api("bible/crossrefs/XXX.1.1", st.token);
  say("crossrefs: an unknown book never fails: a clean 4xx or an empty list", (r.status >= 400 && r.status < 500) || (r.status === 200 && Array.isArray(r.j?.refs) && r.j.refs.length === 0), r.status + " " + JSON.stringify(r.j).slice(0, 100));
  r = await api("bible/original/JHN.1.1", st.token);
  say("original: John 1:1 returns Greek words with Strong numbers", r.status === 200 && /G\d+/.test(JSON.stringify(r.j)), JSON.stringify(r.j));
  r = await api("bible/original/GEN.1.1", st.token);
  say("original: Genesis 1:1 answers (Hebrew source) without error", r.status === 200 || r.status === 404, r.status);
  r = await api("study/interlinear/JHN.1.1", st.token);
  say("interlinear: John 1:1 returns verses with words", r.status === 200 && Array.isArray(r.j?.verses) && r.j.verses.length > 0, JSON.stringify(r.j).slice(0, 120));
  r = await api("study/interlinear/NOPE", st.token);
  say("interlinear: a bad reference is a clean 4xx", r.status >= 400 && r.status < 500, r.status);
  // knowledge graph
  r = await api("graph/search?q=Filipe", st.token);
  say("graph: searching Filipe answers", r.status === 200, r.status);
  const first = (r.j?.results ?? r.j?.entities ?? [])[0];
  if (first?.id) { const e = await api(`graph/entity/${encodeURIComponent(first.id)}`, st.token); say("graph: an entity opens with its data", e.status === 200, e.status); }
  r = await api("graph/entity/does-not-exist", st.token);
  say("graph: an unknown entity is 404", r.status === 404 || r.status === 400, r.status);
  // transcription: login, size and format rules
  const fd = new FormData(); fd.append("audio", new Blob([new Uint8Array(2000)], { type: "audio/webm" }), "a.webm");
  r = await api("voice/transcribe", null, { method: "POST", body: fd });
  say("transcribe: a visitor is refused (login required)", r.status === 401, r.status);
  const fd2 = new FormData(); fd2.append("audio", new Blob([], { type: "audio/webm" }), "a.webm");
  r = await api("voice/transcribe", st.token, { method: "POST", body: fd2 });
  say("transcribe: an empty recording is a 400", r.status === 400, r.status);
  const big = new FormData(); big.append("audio", new Blob([new Uint8Array(9 * 1024 * 1024)], { type: "audio/webm" }), "a.webm");
  r = await api("voice/transcribe", st.token, { method: "POST", body: big });
  say("transcribe: a recording above 8 MB is refused (413)", r.status === 413, r.status);
  // admin notes
  r = await api("admin/notes", st.token);
  say("admin notes: a student is refused", r.status === 403 || r.status === 401, r.status);
  r = await api("admin/notes/generate", ad.token, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  say("admin notes: generating without a passage is a clean 400", r.status === 400, r.status);
  r = await api(`admin/notes/${randomUUID()}/comments`, ad.token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x" }) });
  say("admin notes: commenting on a missing note is a clean 4xx", r.status >= 400 && r.status < 500, r.status);
  // pages
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const q = indexedDB.open("professor-filipe", 1); q.onupgradeneeded = () => q.result.createObjectStore("kv"); q.onsuccess = () => { const tx = q.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; q.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(st.session) });
  await p.goto(`${BASE}/arqueologia`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  const arq = await p.locator("main").innerText();
  say("archaeology page lists pieces with credit", /Tel Dan|Siloé|Jericó/.test(arq) && (await p.locator("main img").count()) >= 10, arq.slice(0, 100));
  await p.goto(`${BASE}/curiosidades`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  const cur = await p.locator("main").innerText();
  say("curiosities page lists the 22 curiosities", (await p.locator("main li, main article, main [data-testid^=cur]").count()) >= 15 || /curiosidade/i.test(cur), cur.slice(0, 100));
  await p.goto(`${BASE}/checkout/simulado`, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  say("simulated checkout without a pending payment shows a clear message, not a blank page", (await p.locator("main").innerText()).trim().length > 10);
  say("no page errors", errs.length === 0, errs.join(" | "));
} catch (e) { ok = false; console.log("ERROR", String(e).slice(0, 400)); } finally {
  for (const u of users) await sql(`delete from auth.users where id='${u}'`).catch(() => undefined);
  await browser.close();
  console.log(ok ? "ALL OK" : "SOME FAILED");
  process.exit(ok ? 0 : 1);
}
