// 360° photo tour (Prompt 3.5b): real navigation by dragging, arrows and place chips; pins; credit always visible; the teacher knows the photo.
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
const pos = async (p) => { const s = (await p.locator("[data-testid=imm-pos]").textContent()).split(","); return { x: +s[0], z: +s[1], yaw: +s[2], zones: (s[3] ?? "").split("+").filter(Boolean) }; };
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
try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, locale: "pt-BR" });
  const p = await login(ctx);
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/imersao`, { waitUntil: "networkidle" });
  say("list: the real-photo tours are offered, the internal test tour is not", (await p.getByTestId("tour-galileia").count()) === 1 && (await p.getByTestId("tour-panorama_teste").count()) === 0);
  await p.getByTestId("tour-galileia").click();
  await p.waitForSelector("[data-testid=pano]", { timeout: 30000 });
  await p.waitForTimeout(2000);
  const gcredit = await p.getByTestId("pano-credit").innerText();
  say("real photo tour opens with the credit of a real photographer", gcredit.includes("Berthold Werner") && gcredit.includes("1/4"), gcredit);
  await p.getByTestId("pano-place-sepphoris").click();
  await p.waitForTimeout(1500);
  say("a place chip loads the next real photo", (await p.getByTestId("pano-credit").innerText()).includes("Yael Alef"));
  await p.goto(`${BASE}/imersao?t=panorama_teste`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-testid=pano]", { timeout: 30000 });
  await p.waitForTimeout(2500);
  const credit = await p.getByTestId("pano-credit").innerText();
  say("credit of the photo is always on screen", credit.includes("Gerada para teste") && credit.includes("Domínio público") && credit.includes("1/2"), credit);
  const canvas = await p.locator("canvas").first().boundingBox();
  say("the photo is drawn (canvas has size)", !!canvas && canvas.width > 500);
  // pins hidden until you look at them; dragging turns the view and brings them in
  const link = p.getByTestId("pano-link-patio");
  say("the arrow to the next place is out of view at first", (await link.evaluate((n) => getComputedStyle(n).display)) === "none");
  await p.mouse.move(800, 350); await p.mouse.down(); await p.mouse.move(650, 350, { steps: 12 }); await p.mouse.up();
  await p.waitForTimeout(1500);
  say("after dragging to the right the arrow is on screen", (await link.evaluate((n) => getComputedStyle(n).display)) === "flex");
  const pin = p.getByTestId("pano-pin-porta");
  say("and so is the pin", (await pin.evaluate((n) => getComputedStyle(n).display)) === "flex", await pin.evaluate((n) => `${n.style.left} ${n.style.top} ${getComputedStyle(n).display}`));
  await pin.dispatchEvent("click");
  await p.waitForSelector("[data-testid=pano-panel]");
  const panel = await p.getByTestId("pano-panel").innerText();
  say("the pin opens its text and verse", panel.includes("ponto de interesse de teste") && panel.includes("João 10"), panel.slice(0, 80));
  await p.getByTestId("pano-panel").getByRole("button", { name: "Fechar" }).click();
  // the teacher knows which photo and pin
  await p.getByTestId("pano-ask").click();
  await p.fill("[data-testid=pano-chat] input", "O que estou vendo?");
  await p.locator("[data-testid=pano-chat] button[type=submit]").click();
  await p.waitForSelector("[data-testid=pano-answer]", { timeout: 30000 }).catch(() => undefined);
  say("guide: the teacher answers", (await p.locator("[data-testid=pano-answer]").count()) >= 1, (await p.getByTestId("pano-chat").innerText().catch(() => "")).slice(0, 200).replace(/\n/g, " | "));
  const lastSys = process.env.MOCK_URL ? await (await fetch(`${process.env.MOCK_URL}/stats`)).json().then((j) => String(j.lastSystem ?? "")).catch(() => "") : "";
  if (lastSys) say("guide: told which photo, its credit, and that it is a photo of today", lastSys.includes("fotos 360") && lastSys.includes("Entrada") && lastSys.includes("Gerada para teste") && lastSys.includes("HOJE"));
  await p.getByTestId("pano-ask").click();
  // moving: arrow, then the chips
  await link.dispatchEvent("click");
  await p.waitForTimeout(1500);
  say("tapping the arrow moves to the next place", (await p.getByTestId("pano-credit").innerText()).includes("2/2") && (await p.locator("[data-testid=pano]").innerText()).includes("Pátio"));
  await p.getByTestId("pano-place-entrada").click();
  await p.waitForTimeout(1500);
  say("the place chips jump anywhere", (await p.getByTestId("pano-credit").innerText()).includes("1/2"));
  await p.getByRole("button", { name: "Ficha histórica" }).click();
  say("sheet lists the credit of every photo", (await p.getByTestId("pano-sheet").innerText()).includes("Créditos das fotos"));
  say("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) { ok = false; console.log("ERROR", String(e).slice(0, 500)); } finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
  process.exit(ok ? 0 : 1);
}
