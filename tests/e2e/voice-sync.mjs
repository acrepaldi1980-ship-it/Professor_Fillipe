// Voice sync (teacher speech): the mouth follows the audible sound within one frame, the sentences play back to back without gaps, and the text appears with the first sound.
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
function wav(sampleRate, parts) { // parts: [seconds, amplitude]
  const n = parts.reduce((a, [s]) => a + Math.round(s * sampleRate), 0);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  let o = 44, i = 0;
  for (const [s, a] of parts) for (let k = 0; k < Math.round(s * sampleRate); k++, i++) { buf.writeInt16LE(Math.round(a * 32767 * (a ? Math.sin((2 * Math.PI * 220 * i) / sampleRate) : 0)), o); o += 2; }
  return buf;
}
const CLIP = wav(22050, [[0.4, 0], [0.6, 0.6], [0.3, 0]]); // 400 ms silence, 600 ms tone, 300 ms silence
const b2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const ctx = await b2.newContext({ viewport: { width: 420, height: 860 }, locale: "pt-BR" });
  await ctx.addInitScript(() => { window.__pfSync = []; });
  const p = await login(ctx);
  let speakCalls = 0;
  p.on("response", async (r) => { if (/teacher\/turn/.test(r.url())) console.log("TURN", r.status(), (await r.text().catch(() => "")).slice(0, 900).replace(/\n/g, " | ")); });
  p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 160)); });
  await p.route("**/api/v1/voice/speak", async (route) => { speakCalls++; await new Promise((r) => setTimeout(r, 120)); await route.fulfill({ status: 200, contentType: "audio/wav", body: CLIP }); });
  await p.goto(`${BASE}/estudo`, { waitUntil: "networkidle" });
  await p.waitForSelector("input[placeholder]", { timeout: 20000 });
  await p.evaluate(() => { window.__bubbleAt = 0; new MutationObserver(() => { if (!window.__bubbleAt && document.body.innerText.includes("Filipe foi um dos sete")) window.__bubbleAt = performance.now(); }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
  await p.fill("input[placeholder]", "Quem foi Filipe em Atos 8?");
  await p.click("button[type=submit]");
  await p.waitForFunction(() => window.__bubbleAt > 0, null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(6000);
  if (!speakCalls) console.log("PAGE:", (await p.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300));
  const { log, bubbleAt } = await p.evaluate(() => ({ log: window.__pfSync, bubbleAt: window.__bubbleAt }));
  const clips = log.filter((e) => e.clip).map((e) => e.clip);
  const frames = log.filter((e) => e.ph !== undefined);
  say("the server voice was asked once per sentence", speakCalls >= 3, `calls=${speakCalls}`);
  say("the audio clock advanced (headless audio works)", frames.length > 30 && frames.at(-1).ph > frames[0].ph, `frames=${frames.length}`);
  say("sentences are queued back to back: each starts exactly when the previous ends (±5 ms)", clips.length >= 3 && clips.slice(1).every((c, i) => Math.abs(c.startAt - clips[i].endAt) < 0.005), JSON.stringify(clips.slice(0, 4)));
  // mouth onset vs the tone: the mouth must open within one frame (+ the envelope attack) after the audible start of the tone, never before it
  const errors = [];
  for (const c of clips.slice(0, 3)) {
    const toneAt = c.startAt + 0.4;
    const open = frames.find((f) => f.ph >= c.startAt && f.level > 0.08);
    if (open) errors.push((open.ph - toneAt) * 1000);
  }
  say("the mouth opens with the sound: within -20 to +45 ms of the audible tone (the jaw may lead by a hair, never lag)", errors.length >= 3 && errors.every((e) => e >= -20 && e <= 45), errors.map((e) => e.toFixed(0)).join(", "));
  const quiet = frames.filter((f) => clips.some((c) => f.ph >= c.startAt + 0.02 && f.ph <= c.startAt + 0.36));
  say("the mouth stays closed during the silence at the start of every sentence", quiet.length > 5 && quiet.every((f) => f.level < 0.02), `maxLevel=${Math.max(...quiet.map((f) => f.level)).toFixed(3)}`);
  const closeAfter = frames.filter((f) => clips.some((c) => f.ph >= c.startAt + 1.05 && f.ph <= c.startAt + 1.28));
  say("and closes again after the sound", closeAfter.length > 3 && closeAfter.every((f) => f.level < 0.05), `maxLevel=${Math.max(...closeAfter.map((f) => f.level)).toFixed(3)}`);
  const clipStartPerf = frames.find((f) => f.ph >= clips[0].startAt)?.t ?? 0;
  console.log("   timeline(ms): clip audible", Math.round(clipStartPerf), "bubble", Math.round(bubbleAt), "tone", Math.round(frames.find((f) => f.level > 0.05)?.t ?? 0));
  const firstSoundPerf = frames.find((f) => f.level > 0.05)?.t ?? 0;
  say("the text appears with the first sound (not seconds before it)", bubbleAt > 0 && firstSoundPerf > 0 && bubbleAt <= firstSoundPerf + 200 && firstSoundPerf - bubbleAt < 600, `bubble=${Math.round(bubbleAt)} firstSound=${Math.round(firstSoundPerf)}`);
} catch (e) { ok = false; console.log("ERROR", String(e).slice(0, 400)); } finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await b2.close(); await browser.close();
  console.log(ok ? "ALL OK" : "SOME FAILED");
  process.exit(ok ? 0 : 1);
}
