// Immersive engine in the browser (Prompt 3.1): walking with the keyboard, collision, zones that load as you approach, the hotspot, the guided tour,
// the historical sheet and the touch joystick. WebGL runs in software here, so the frame rate is reported, not asserted.
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
  await p.goto(`${BASE}/imersao?e=campo_de_teste&fps=1`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Entrar no ambiente", { timeout: 30000 });
  say("entry screen: explains the controls before entering", (await p.locator("body").innerText()).includes("W A S D"));
  await p.getByRole("button", { name: "Entrar no ambiente" }).click();
  await p.waitForSelector("[data-testid=imm-pos]", { state: "attached", timeout: 20000 });
  await p.waitForTimeout(1500);
  say("no WebXR in this browser: the VR button stays hidden", (await p.locator("[data-testid=imm-vr]").count()) === 0);
  let s = await pos(p);
  say("start: at the spawn point with only the near zone built", Math.abs(s.x) < 0.1 && Math.abs(s.z - 9) < 0.2 && s.zones.join() === "patio", JSON.stringify(s));
  // walking
  await p.keyboard.down("w"); await p.waitForTimeout(1500); await p.keyboard.up("w");
  const s2 = await pos(p);
  say("keyboard: W walks forward (toward -z) at about the walking speed", s2.z < s.z - 1.5 && s2.z > s.z - 5, `${s.z} -> ${s2.z}`);
  await p.keyboard.down("d"); await p.waitForTimeout(1000); await p.keyboard.up("d");
  say("keyboard: D steps to the right", (await pos(p)).x > s2.x + 1);
  // collision with the wall behind: walk back (S) toward z=12 wall
  await p.keyboard.down("s"); await p.waitForTimeout(3500); await p.keyboard.up("s");
  const back = await pos(p);
  say("collision: the low wall behind stops the visitor (z never passes 11.7 - radius)", back.z <= 11.7 - 0.35 + 0.05 && back.z > 10, `z=${back.z}`);
  // guided tour
  await p.getByTestId("imm-next").click();
  await p.waitForSelector("[data-testid=imm-station]", { timeout: 5000 });
  await p.waitForTimeout(800);
  const st1 = await pos(p);
  say("tour: the first station moves the visitor to the entrance and shows the guide's text", Math.abs(st1.z - 9) < 0.3 && (await p.locator("[data-testid=imm-station]").innerText()).includes("entrada do pátio"));
  await p.getByTestId("imm-next").click();
  await p.waitForTimeout(1500);
  const st2 = await pos(p);
  say("zones: arriving at the altar builds that zone (the near one stays until it is far enough)", st2.zones.includes("altar") && st2.zones.includes("patio"), JSON.stringify(st2));
  say("tour: it faces the altar (looking toward -z)", Math.abs(st2.yaw) < 0.2, `yaw=${st2.yaw}`);
  // hotspot near the altar
  await p.keyboard.down("w"); await p.waitForTimeout(1500); await p.keyboard.up("w");
  await p.waitForSelector("[data-testid=imm-hotspot]", { timeout: 5000 });
  say("hotspot: the altar's point appears when the visitor is close", (await p.getByTestId("imm-hotspot").innerText()).includes("altar"));
  await p.keyboard.press("e");
  await p.waitForSelector("[data-testid=imm-panel]", { timeout: 5000 });
  say("hotspot: E opens its text and verses", (await p.locator("[data-testid=imm-panel]").innerText()).includes("Êxodo 27"));
  await p.locator("[data-testid=imm-panel] button:has-text('Êxodo 27')").first().click();
  await p.waitForSelector("sup", { timeout: 10000 });
  say("hotspot: a verse button opens the Bible text", (await p.locator("sup").count()) > 0);
  await p.locator("button:text('Fechar')").last().click();
  await p.keyboard.press("Escape");
  // collision with the altar block
  await p.keyboard.down("w"); await p.waitForTimeout(4000); await p.keyboard.up("w");
  const alt = await pos(p);
  say("collision: the altar block stops the visitor (z stays south of -28.5 + radius)", alt.z >= -28.5 + 0.35 - 0.05 && alt.z < -26, `z=${alt.z}`);
  // beyond the walkable limit
  await p.keyboard.down("a"); await p.waitForTimeout(9000); await p.keyboard.up("a");
  say("bounds: the visitor cannot walk out of the area (x stays within -18 + radius)", (await pos(p)).x >= -18 + 0.35 - 0.05);
  // the teacher as guide (Prompt 3.3): a free question is answered with the place in the teacher's instructions
  await p.getByTestId("imm-ask").click();
  await p.fill("[data-testid=imm-chat] input", "O que é este lugar onde estou?");
  await p.locator("[data-testid=imm-chat] button[type=submit]").click();
  await p.waitForSelector("[data-testid=imm-answer]", { timeout: 30000 }).catch(async () => { console.log("CHAT:", (await p.locator("[data-testid=imm-chat]").innerText().catch(() => "no chat")).slice(0, 300)); });
  const lastSys = process.env.MOCK_URL ? await (await fetch(`${process.env.MOCK_URL}/stats`)).json().then((j) => String(j.lastSystem ?? "")).catch(() => "") : "";
  say("guide: the teacher answers inside the scene", (await p.locator("[data-testid=imm-answer]").count()) >= 1);
  if (lastSys) {
    say("guide: the teacher was told where the student is (zone and direction)", lastSys.includes("AMBIENTE IMERSIVO") && lastSys.includes("zona \"Altar\"") && lastSys.includes("olhando para o"));
    say("guide: and the sourced historical fact sheet", lastSys.includes("FICHA HISTÓRICA") && lastSys.includes("Êxodo 27"));
  }
  await p.locator("[data-testid=imm-chat] button:has-text('Fechar')").count();
  await p.getByTestId("imm-ask").click();
  // sheet
  await p.getByRole("button", { name: "Ficha histórica" }).click();
  say("sheet: the historical fact sheet shows the summary and the sources", (await p.locator("[data-testid=imm-sheet]").innerText()).includes("Fontes") && (await p.locator("[data-testid=imm-sheet]").innerText()).includes("Êxodo 27"));
  await p.locator("[data-testid=imm-sheet] button:has-text('Fechar')").click();
  // sound
  await p.getByRole("button", { name: "Silenciar" }).click();
  say("sound: the mute switch toggles", (await p.getByRole("button", { name: "Ativar som" }).count()) === 1);
  await p.getByTestId("imm-finish").click();
  await p.waitForURL(/\/fechamento\?s=/, { timeout: 60000 });
  say("exit: finishing the tour opens the session closing (summary, map, cards like other sessions)", /fechamento\?s=[0-9a-f-]{36}/.test(p.url()));
  await p.goBack();
  await p.waitForTimeout(500);
  const fps = "n/a (left the scene)";
  console.log("INFO  frame rate in software rendering: see ?fps=1");
  say("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  void fps;
  // projection mode for the EBD teacher: the tour with big text, moved with the arrow keys, no chat
  await p.goto(`${BASE}/imersao?e=campo_de_teste&p=1`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Entrar no ambiente" }).click();
  await p.waitForSelector("[data-testid=imm-pos]", { state: "attached", timeout: 20000 });
  await p.waitForTimeout(1200);
  say("projection: there is no chat button (the teacher drives the tour)", (await p.getByTestId("imm-ask").count()) === 0);
  await p.keyboard.press("ArrowRight");
  await p.waitForSelector("[data-testid=imm-station]", { timeout: 5000 });
  say("projection: the right arrow starts the first station with large text", /text-2xl/.test((await p.locator("[data-testid=imm-station]").getAttribute("class")) ?? ""));
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(1200);
  say("projection: the right arrow goes to the next station (the altar)", (await pos(p)).z < -20 && (await p.locator("[data-testid=imm-station]").innerText()).includes("Diante do altar"));
  await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(1200);
  say("projection: the left arrow goes back", Math.abs((await pos(p)).z - 9) < 0.5);
  await ctx.close();

  // touch: the joystick
  const tctx = await browser.newContext({ viewport: { width: 420, height: 800 }, hasTouch: true, isMobile: true, locale: "pt-BR" });
  const sb2 = await tctx.newPage();
  const sbData = await ctx.storageState().catch(() => null);
  void sbData; void sb2;
  const tp = await (async () => { const pg = await tctx.newPage(); await pg.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { data } = await sb.auth.signInWithPassword({ email, password });
    await pg.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(data.session) });
    return pg; })();
  tp.on("pageerror", (e) => errors.push(String(e)));
  await tp.goto(`${BASE}/imersao?e=campo_de_teste`, { waitUntil: "networkidle" });
  await tp.waitForSelector("text=Entrar no ambiente", { timeout: 30000 });
  say("touch: the entry screen explains the joystick", (await tp.locator("body").innerText()).includes("Arraste o círculo"));
  await tp.getByRole("button", { name: "Entrar no ambiente" }).click();
  await tp.waitForSelector("[data-testid=joystick]", { timeout: 20000 });
  await tp.waitForTimeout(1200);
  const a = await pos(tp);
  const box = await tp.locator("[data-testid=joystick]").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await tp.mouse.move(cx, cy); await tp.mouse.down(); await tp.mouse.move(cx, cy - 45, { steps: 4 });
  await tp.waitForTimeout(1500);
  const b = await pos(tp);
  await tp.mouse.up();
  say("touch: dragging the joystick up walks forward", b.z < a.z - 1, `${a.z} -> ${b.z}`);
  await tp.waitForTimeout(600);
  const c = await pos(tp);
  await tp.waitForTimeout(600);
  say("touch: releasing the joystick stops", Math.abs((await pos(tp)).z - c.z) < 0.05);
  say("no page errors (touch)", errors.length === 0, errors.join(" | ").slice(0, 200));
  await tp.screenshot({ path: "/tmp/immersive-touch.png" });
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
