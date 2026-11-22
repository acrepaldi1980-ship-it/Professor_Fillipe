// Ensaio do sermão in the browser: consent screen, recording with a fake microphone (real speech file), analysis shown, history and comparison.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const email = `ru-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
if (!existsSync("/tmp/rehearsal/r1.pcm")) throw new Error("run tests/e2e/rehearsal.mjs first (it synthesizes the speech)");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", "22050", "-ac", "1", "-i", "/tmp/rehearsal/r1.pcm", "-ar", "48000", "/tmp/rehearsal/fake.wav"]);
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=/tmp/rehearsal/fake.wav"] });
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${password}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  await sql(`insert into entitlements (user_id, entitlement, source) values ('${id}','plan:premium','admin')`);
  const sid = randomUUID();
  await sql(`insert into sessions (id, user_id, mode, title, topic) values ('${sid}','${id}','sermon','Atos 8','Atos 8:26-40')`);
  const outline = { title: "Você entende o que lê?", base_text: "ACT.8.26-ACT.8.35", central_idea: "Deus coloca a pessoa certa no caminho.", introduction: "A pergunta de Filipe.", divisions: [{ title: "Deus toma a iniciativa", texts: ["ACT.8.26"], explanation: "x" }, { title: "A palavra precisa ser explicada", texts: ["ACT.8.30"], explanation: "y" }], conclusion: "Seja o Filipe de alguém.", estimated_minutes: 4 };
  await sql(`insert into sermon_outlines (user_id, session_id, data) values ('${id}','${sid}','${JSON.stringify(outline).replace(/'/g, "''")}'::jsonb)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "pt-BR", permissions: ["microphone"] });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });

  await p.goto(`${BASE}/estudo?s=${sid}`, { waitUntil: "networkidle" });
  await p.getByRole("tab", { name: "Ensaio" }).first().click();
  await p.waitForSelector("[data-testid=reh-consent]", { timeout: 20000 });
  say("ui: the consent screen explains the recording and that the audio is deleted", (await p.locator("[data-testid=reh-consent]").innerText()).includes("apagado"));
  await p.getByRole("button", { name: "Concordo em gravar o ensaio" }).click();
  await p.getByRole("button", { name: "Começar o ensaio" }).waitFor({ timeout: 15000 });
  say("ui: after consent the rehearsal can start", true);

  async function rehearse(seconds) {
    await p.getByRole("button", { name: "Começar o ensaio" }).click();
    await p.waitForSelector("[data-testid=reh-timer]", { timeout: 10000 });
    await p.waitForTimeout(seconds * 1000);
    say("ui: the timer runs while recording", /^\d+:\d\d/.test(await p.locator("[data-testid=reh-timer]").innerText()));
    await p.getByRole("button", { name: "Terminar e analisar" }).click();
    await p.waitForSelector("[data-testid=reh-result]", { timeout: 60000 });
  }
  await rehearse(45);
  const txt = await p.locator("[data-testid=reh-result]").innerText();
  say("ui: the result shows time, pace and parts", /palavras por minuto/.test(txt) && /Tempo por parte/.test(txt) && /Introdução/.test(txt));
  say("ui: the result shows 3 strengths and the improvements", /3 pontos fortes/.test(txt) && /Para melhorar/.test(txt));
  say("ui: it says the audio was deleted", /áudio foi apagado/.test(txt));
  await p.getByRole("button", { name: "Começar o ensaio" }).waitFor();
  await rehearse(45);
  await p.getByRole("checkbox", { name: /Comparar o ensaio/ }).nth(0).check();
  await p.getByRole("checkbox", { name: /Comparar o ensaio/ }).nth(1).check();
  await p.waitForSelector("[data-testid=reh-compare]", { timeout: 30000 });
  const cmp = await p.locator("[data-testid=reh-compare]").innerText();
  say("ui: two ticked rehearsals are compared (before/after, improvements asked)", /Antes/.test(cmp) && /Depois/.test(cmp) && /o que o ensaio anterior pediu|O que o ensaio anterior pediu/i.test(cmp));
  say("ui: no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await p.screenshot({ path: "/tmp/rehearsal/ui.png", fullPage: false });
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
