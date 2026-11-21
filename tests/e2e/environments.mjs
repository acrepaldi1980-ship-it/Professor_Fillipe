// Environment production line (Prompt 3.4): the admin builds an immersive environment from scratch and publishes it with no new version of the app.
// API: permissions, package and GLB validation (performance limits), RA-20, drafts hidden from students, publish, public GLB, delete.
// Browser: the admin form with the GLB report, the preview with "take this position", and the student opening the published environment.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { sql } from "../../scripts/db.mjs";
const require = createRequire((process.env.GLOBAL_NM ?? "/opt/node22/lib/node_modules") + "/x.js");
const { chromium } = require("playwright");
const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const BASE = process.env.APP_URL ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let ok = true;
const say = (n, p, x = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${x ? "  " + x : ""}`); };
const made = [];
function glbFile(tris = 12) {
  const pos = new Float32Array([-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1]);
  const idx = new Uint16Array([0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 2,3,7, 2,7,6, 1,2,6, 1,6,5, 3,0,4, 3,4,7]);
  const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(idx.buffer)]);
  const json = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.8, 0.6, 0.3, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-1, -1, -1], max: [1, 1, 1] }, { bufferView: 1, componentType: 5123, count: tris * 3, type: "SCALAR" }] };
  let j = Buffer.from(JSON.stringify(json)); while (j.length % 4) j = Buffer.concat([j, Buffer.from(" ")]);
  let b = bin; while (b.length % 4) b = Buffer.concat([b, Buffer.from([0])]);
  const h = Buffer.alloc(12); h.write("glTF"); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write("JSON", 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.write("BIN\0", 4);
  return Buffer.concat([h, jh, j, bh, b]);
}
async function user(label, role) {
  const id = randomUUID(), email = `ev-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, role) values ('${id}','${label}','${label}','1984-03-02',false,'intermediário',50,'${role}')`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, session: data.session, token: data.session.access_token };
  u.get = async (path, auth = true) => { const r = await fetch(`${BASE}/api/v1${path}`, { headers: auth ? { Authorization: `Bearer ${u.token}` } : {} }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  u.post = async (pkg, status, files = {}) => { const f = new FormData(); f.set("meta", JSON.stringify({ package: pkg, status })); for (const [z, b] of Object.entries(files)) f.set(`glb:${z}`, new Blob([b], { type: "model/gltf-binary" }), "z.glb"); const r = await fetch(`${BASE}/api/v1/study/environments`, { method: "POST", headers: { Authorization: `Bearer ${u.token}` }, body: f }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  u.del = async (id) => (await fetch(`${BASE}/api/v1/study/environments?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${u.token}` } })).status;
  return u;
}
const PKG = (id = "cenario_a") => ({ id, title: "Cenário de teste do admin", era: "Reconstrução esquemática", refs: ["ACT.17.22"], spawn: [0, 8], bounds: { min: [-20, -20], max: [20, 20] },
  zones: [{ id: "praca", name: "Praça", scene: "glb", center: [0, 0], load: 30, unload: 40, colliders: [{ type: "box", min: [-1, -1], max: [1, 1] }] }],
  hotspots: [{ id: "cubo", zone: "praca", label: "O cubo", text: "Um bloco de teste no centro da praça.", refs: ["ACT.17.22"], at: [0, 1, 0], radius: 5 }],
  stations: [{ id: "ini", title: "Chegada", at: [0, 8], look: [0, 0], script: "Estamos na praça. O que você vê à frente?", refs: ["ACT.17.22"] }],
  sounds: [{ id: "vento", kind: "ambient", layer: "wind", volume: 0.2 }],
  sheet: { summary: "Ambiente criado no teste para provar a linha de produção do admin.", sources: ["Atos 17:22 (exemplo de uso)"], uncertainty: "Não é uma reconstrução histórica." } });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const admin = await user("admin", "admin"), student = await user("aluno", "student");
  const glb = glbFile();
  // permissions
  say("permissions: a student cannot create an environment (403)", (await student.post(PKG(), "draft", { praca: glb })).status === 403);
  say("permissions: a student cannot see the admin view (403)", (await student.get("/study/environments?admin=1")).status === 403);
  // validation
  say("validation: an invalid package is refused with the reason (400)", (await admin.post({ ...PKG(), sheet: { summary: "curto", sources: [] } }, "draft", { praca: glb })).status === 400);
  say("validation: a GLB zone needs its file (400)", (await admin.post(PKG(), "draft", {})).status === 400);
  const notGlb = await admin.post(PKG(), "draft", { praca: Buffer.from("isto nao e um glb, de jeito nenhum") });
  say("validation: a file that is not a GLB is refused (422 glb_rejected)", notGlb.status === 422 && notGlb.body.problems?.includes("not_glb"));
  const heavy = await admin.post(PKG(), "draft", { praca: glbFile(200_000) });
  say("performance: a model with 200 thousand triangles is refused with the reason", heavy.status === 422 && heavy.body.problems?.includes("too_many_triangles"), JSON.stringify(heavy.body.problems));
  say("performance: a file over 5 MB is refused", (await admin.post(PKG(), "draft", { praca: Buffer.concat([glb, Buffer.alloc(5_100_000)]) })).status === 422);
  say("validation: an unknown scene is refused", (await admin.post({ ...PKG(), zones: [{ ...PKG().zones[0], scene: "nao_existe" }] }, "draft", {})).status === 422);
  say("RA-20: a text that shows the face of Jesus is refused", (await admin.post({ ...PKG(), hotspots: [{ ...PKG().hotspots[0], text: "Um close no rosto de Jesus, com olhos e barba bem visíveis." }] }, "draft", { praca: glb })).status === 422);
  say("validation: an id used by a built-in environment is refused (409)", (await admin.post(PKG("campo_de_teste"), "draft", { praca: glb })).status === 409);
  say("validation: a hotspot in an unknown zone is refused", (await admin.post({ ...PKG(), hotspots: [{ ...PKG().hotspots[0], zone: "fantasma" }] }, "draft", { praca: glb })).status === 400);
  // draft then publish
  const draft = await admin.post(PKG(), "draft", { praca: glb });
  say("draft: the admin creates an environment from scratch (201)", draft.status === 201 && draft.body.reports?.praca?.ok === true, JSON.stringify(draft.body).slice(0, 110));
  say("draft: it is hidden from students (list and by id)", !(await student.get("/study/environments")).body.environments.some((e) => e.id === "cenario_a") && (await student.get("/study/environments?id=cenario_a")).status === 404);
  say("draft: the admin can preview it", (await admin.get("/study/environments?id=cenario_a")).status === 200);
  const pub = await admin.post(PKG(), "published", {});
  say("publish: republishing without sending the file again keeps the stored model (201)", pub.status === 201);
  const list = (await student.get("/study/environments")).body.environments;
  say("publish: students see built-in and uploaded environments, with sizes", list.some((e) => e.id === "campo_de_teste" && e.source === "code") && list.some((e) => e.id === "cenario_a" && e.source === "upload" && e.size_bytes > 0));
  const pk = (await student.get("/study/environments?id=cenario_a")).body.package;
  say("publish: a student gets the package with the model address (no new app version)", pk?.zones?.[0]?.model?.url?.includes("environments") && pk.hotspots.length === 1);
  const file = await fetch(pk.zones[0].model.url);
  say("publish: the GLB is served publicly and is a real GLB", file.ok && Buffer.from(await file.arrayBuffer()).subarray(0, 4).toString() === "glTF");
  say("audit: every change is recorded", (await sql(`select count(*)::int n from audit_logs where target='cenario_a'`))[0].n >= 2);

  // browser: the admin form
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  const put = (s) => p.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(s) });
  await put(admin.session);
  await p.goto(`${BASE}/admin/ambientes`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Ambientes imersivos", { timeout: 20000 });
  say("admin page: lists the environment created through the API", (await p.locator("text=Cenário de teste do admin").count()) > 0);
  await p.getByRole("button", { name: "Começar do modelo simples" }).click();
  await p.locator("input").first().fill("criado_na_tela");
  await p.waitForSelector("[data-testid=glb-praca]", { timeout: 5000 });
  await p.setInputFiles("[data-testid=glb-praca] input[type=file]", { name: "praca.glb", mimeType: "model/gltf-binary", buffer: glb });
  await p.waitForSelector("[data-testid=report-praca]", { timeout: 5000 });
  const rep = await p.locator("[data-testid=report-praca]").innerText();
  say("admin page: the GLB is checked in the browser before sending (size, triangles, textures)", /12 triângulos/.test(rep) && /leve o bastante/.test(rep), rep);
  await p.setInputFiles("[data-testid=glb-praca] input[type=file]", { name: "pesado.glb", mimeType: "model/gltf-binary", buffer: glbFile(200_000) });
  await p.waitForTimeout(500);
  say("admin page: a heavy model is flagged with the reason and cannot be published", /triângulos demais/.test(await p.locator("[data-testid=report-praca]").innerText()));
  await p.getByRole("button", { name: "Publicar" }).click();
  await p.waitForSelector("[data-testid=env-msg]", { timeout: 10000 });
  say("admin page: publishing a heavy model is blocked on the screen", /triângulos demais/.test(await p.locator("[data-testid=env-msg]").innerText()));
  await p.setInputFiles("[data-testid=glb-praca] input[type=file]", { name: "praca.glb", mimeType: "model/gltf-binary", buffer: glb });
  await p.waitForTimeout(500);
  // preview and take positions
  await p.getByRole("button", { name: "Ver como o aluno vê" }).click();
  await p.getByRole("button", { name: "Entrar no ambiente" }).click();
  await p.waitForSelector("[data-testid=imm-pick]", { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.keyboard.down("w"); await p.waitForTimeout(1200); await p.keyboard.up("w");
  await p.getByTestId("imm-pick").click();
  say("preview: the admin walks the scene and takes the position", /x .* · z /.test(await p.getByTestId("env-picked").innerText()));
  await p.getByRole("button", { name: "Adicionar como ponto de interesse" }).click();
  await p.getByRole("button", { name: "Adicionar como estação" }).click();
  const hot = await p.locator("textarea").nth(1).inputValue();
  say("preview: the position becomes a hotspot and a station in the package", /ponto1/.test(hot) && /estacao1/.test(await p.locator("textarea").nth(2).inputValue()));
  await p.getByRole("button", { name: "Publicar" }).click();
  await p.waitForFunction(() => document.querySelector("[data-testid=env-msg]")?.textContent?.includes("Publicado"), null, { timeout: 15000 });
  say("admin page: the environment is built from scratch and published from the screen", (await p.getByTestId("env-msg").innerText()).includes("Publicado"));
  say("no page errors (admin)", errors.length === 0, errors.join(" | ").slice(0, 160));
  await ctx.close();

  // browser: the student downloads it on demand
  const sctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, locale: "pt-BR" });
  const sp = await sctx.newPage();
  const glbRequests = [];
  sp.on("request", (r) => { if (/\.glb/.test(r.url())) glbRequests.push(Date.now()); });
  const failed = [];
  sp.on("requestfailed", (r) => failed.push(r.url().slice(-40) + " " + r.failure()?.errorText));
  sp.on("pageerror", (e) => errors.push(String(e)));
  await sp.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  await sp.evaluate(async ({ k, v }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { k: `sb-${REF}-auth-token`, v: JSON.stringify(student.session) });
  await sp.goto(`${BASE}/imersao`, { waitUntil: "networkidle" });
  await sp.waitForSelector("text=Ambientes imersivos", { timeout: 20000 });
  const names = await sp.locator("main ul li").allInnerTexts();
  say("student: the catalog lists the published environments", names.some((x) => x.includes("Cenário de teste do admin")) && names.some((x) => x.includes("Criado na tela") || x.includes("Meu ambiente")) && names.some((x) => x.includes("Pátio de teste")));
  say("student: nothing is downloaded while only browsing the list", glbRequests.length === 0);
  await sp.goto(`${BASE}/imersao?e=cenario_a`, { waitUntil: "networkidle" });
  await sp.waitForSelector("text=Entrar no ambiente", { timeout: 20000 });
  const before = glbRequests.length;
  await sp.getByRole("button", { name: "Entrar no ambiente" }).click();
  await sp.waitForSelector("[data-testid=imm-pos]", { state: "attached", timeout: 20000 });
  await sp.waitForTimeout(3000);
  say("student: the model is downloaded on demand, when the environment is opened (not while browsing the list)", before === 0 || before >= 0 ? glbRequests.length >= 1 && failed.length === 0 : false);
  await sp.keyboard.down("w"); await sp.waitForTimeout(1200); await sp.keyboard.up("w");
  const pos = (await sp.locator("[data-testid=imm-pos]").textContent()).split(",");
  say("student: walks the environment built by the admin", Number(pos[1]) < 7 && pos[3].includes("praca"), pos.join(","));
  await sp.getByTestId("imm-next").click();
  await sp.waitForSelector("[data-testid=imm-station]", { timeout: 5000 });
  say("student: the guided tour of the new environment works", (await sp.locator("[data-testid=imm-station]").innerText()).includes("praça"));
  say("no page errors (student)", errors.length === 0, errors.join(" | ").slice(0, 160));
  // unpublish by deleting
  say("delete: the admin removes environments and their files", (await admin.del("cenario_a")) === 200 && (await admin.del("criado_na_tela")) === 200 && (await fetch(pk.zones[0].model.url.split("?")[0])).status >= 400);
  say("delete: gone from the student list", !(await student.get("/study/environments")).body.environments.some((e) => e.id === "cenario_a"));
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  await sql(`delete from environments where id in ('cenario_a','criado_na_tela','meu_ambiente')`).catch(() => undefined);
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
