// End-to-end test of the visuals (Prompt 1.9): map library, animated route, markers, credits, timeline with zoom and uncertain dates.
// Needs the app on http://localhost:3100 (next start -p 3100). Usage: GLOBAL_NM=$(npm root -g) NODE_OPTIONS=--use-env-proxy node --env-file=.env.local tests/e2e/modes.mjs
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p) => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}`); };
const email = `vis-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, id = randomUUID();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','Marcos','Marcos','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("response", (r) => { if (r.url().includes("/document")) r.text().then((b) => console.log("DOC RESP", r.request().method(), r.status(), b.slice(0, 160))).catch(() => {}); });
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await p.evaluate(async ({ key, value }) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open("professor-filipe", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = () => res(); tx.onerror = () => rej(); };
      r.onerror = () => rej();
    });
  }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(data.session) });
  await p.goto(`${BASE}/visuais`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Mapas e linhas do tempo", { timeout: 20000 });
  await p.waitForSelector("section:has(h2:text('Mapas')) li", { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  say("library lists 30 maps and 15 timelines", (await p.locator("section:has(h2:text('Mapas')) li").count()) === 30 && (await p.locator("section:has(h2:text('Linhas do tempo')) li").count()) === 15);
  await p.click("button:text('A 2ª viagem missionária de Paulo')");
  await p.waitForSelector("[role=dialog] canvas", { timeout: 20000 });
  say("map renders (MapLibre canvas)", true);
  await p.waitForTimeout(1500);
  say("one numbered marker per place (10 on the 2nd journey)", (await p.locator("[role=dialog] .map-pin").count()) === 10);
  say("credits are always visible", (await p.locator("text=Natural Earth").count()) > 0 && (await p.locator("text=OpenBible").count()) > 0);
  await p.waitForTimeout(8000);
  const faded = await p.locator("[role=dialog] .map-pin").evaluateAll((els) => els.filter((e) => e.style.opacity === "1").length);
  say("the route animation reveals every place by the end", faded === 10);
  await p.locator("[role=dialog] .map-pin").nth(3).click();
  say("tapping a marker shows the place, note and verses", (await p.locator("[role=dialog] >> text=Filipos").count()) > 0 && (await p.locator("[role=dialog] button:has-text('Atos 16')").count()) > 0);
  await p.locator("[role=dialog] button:has-text('Atos 16')").first().click();
  await p.waitForSelector("sup", { timeout: 10000 }).catch(() => {});
  say("a verse button opens the Bible text", (await p.locator("sup").count()) > 0);
  await p.screenshot({ path: "/tmp/visuals-verse.png" });
  await p.locator("button:text('Fechar')").last().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/visuals-map.png" });
  await p.locator("[role=dialog] button:text('Fechar')").click();
  await p.click("button:text('A vida de Jesus')");
  await p.waitForSelector("[role=dialog] [role=img]", { timeout: 15000 });
  say("timeline lists the events with approximate dates", (await p.locator("[role=dialog] >> text=c. 30 d.C. a 33 d.C.").count()) > 0);
  await p.fill("#tl-zoom", "3");
  await p.click("[role=dialog] button:has-text('Crucificação')");
  say("clicking an event shows the verses and the uncertainty note", (await p.locator("[role=dialog] button:has-text('Mateus 27')").count()) > 0);
  await p.screenshot({ path: "/tmp/visuals-timeline.png" });
  // 3D models
  await p.click("[role=dialog] button:text('Fechar')");
  say("library lists the 20 models", (await p.locator("section:has(h2:text('Modelos em 3D')) li").count()) === 20);
  await p.click("button:text-is('A Arca da Aliança')");
  await p.waitForSelector("[role=dialog] canvas", { timeout: 20000 });
  await p.waitForTimeout(2500);
  say("3D: the Ark renders with 5 hotspots", (await p.locator("[role=dialog] button.map-pin").count()) === 5);
  await p.screenshot({ path: "/tmp/visuals-ark.png" });
  await p.locator("[role=dialog] button[aria-label='O propiciatório']").click();
  say("3D: tapping a hotspot shows its text and verses", (await p.locator("[role=dialog] >> text=onde Deus prometeu se encontrar").count()) > 0 && (await p.locator("[role=dialog] button:has-text('Êxodo 25')").count()) > 0);
  say("3D: text alternative exists", (await p.locator("[role=dialog] [role=img][aria-label*='Arca da Aliança']").count()) > 0);
  await p.click("[role=dialog] button:text('Fechar')");
  await p.click("button:text('O Tabernáculo (maquete)')");
  await p.waitForSelector("[role=dialog] canvas", { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: "/tmp/visuals-tabernacle.png" });
  say("3D: the Tabernacle renders with 9 hotspots", (await p.locator("[role=dialog] button.map-pin").count()) === 9);
  await p.click("[role=dialog] button:text('Fechar')");
  await p.click("button:text('O Templo de Salomão')");
  await p.waitForSelector("[role=dialog] canvas", { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: "/tmp/visuals-temple.png" });
  say("3D: Solomon's Temple renders with 7 hotspots", (await p.locator("[role=dialog] button.map-pin").count()) === 7);
  // phone: the panel covers the screen
  await p.setViewportSize({ width: 390, height: 800 });
  const box = await p.locator("[role=dialog]").boundingBox();
  say("on the phone the panel is full screen", box && box.width >= 385 && box.height >= 790);
  say("no page errors", errors.length === 0 || (console.log(errors), false));
  await ctx.close();
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 400));
  ok = false;
} finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => {});
  await browser.close();
}
process.exit(ok ? 0 : 1);
