// 3D model catalog end to end (Prompt 2.6): the admin adds a GLB model with hotspots without touching the code; the student browses by theme.
// API: admin-only writes, validation (file type, size, RA-20, id clash), public listing, hidden models, deletion, audit. Browser: admin form with
// preview and the student's catalog (theme filter, search, the uploaded model opens in 3D).
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

// a minimal valid GLB: one cube (8 vertices, 12 triangles)
function cubeGlb() {
  const pos = new Float32Array([-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1]);
  const idx = new Uint16Array([0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 2,3,7, 2,7,6, 1,2,6, 1,6,5, 3,0,4, 3,4,7]);
  const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(idx.buffer)]);
  const json = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.8, 0.6, 0.3, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-1, -1, -1], max: [1, 1, 1] }, { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" }] };
  let j = Buffer.from(JSON.stringify(json)); while (j.length % 4) j = Buffer.concat([j, Buffer.from(" ")]);
  let b = bin; while (b.length % 4) b = Buffer.concat([b, Buffer.from([0])]);
  const h = Buffer.alloc(12); h.write("glTF"); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write("JSON", 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.write("BIN\0", 4);
  return Buffer.concat([h, jh, j, bh, b]);
}
async function user(label, role) {
  const id = randomUUID(), email = `m3-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score, role) values ('${id}','${label}','${label}','1984-03-02',false,'intermediário',50,'${role}')`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, session: data.session, token: data.session.access_token };
  u.post = async (meta, file) => { const f = new FormData(); f.set("meta", typeof meta === "string" ? meta : JSON.stringify(meta)); if (file) f.set("file", new Blob([file], { type: "model/gltf-binary" }), "m.glb"); const r = await fetch(`${BASE}/api/v1/visuals/models`, { method: "POST", headers: { Authorization: `Bearer ${u.token}` }, body: f }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  u.call = async (method, path) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}` } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return u;
}
const META = { id: "casa_de_pedro", name: "A casa de Pedro em Cafarnaum", theme: "Jesus e os Evangelhos", alt: "Modelo 3D de um bloco simples que representa, de forma esquemática, a casa de Pedro em Cafarnaum, feita de pedra de basalto.", note: "Reconstrução esquemática; o texto bíblico não descreve a casa em detalhes.", refs: ["MRK.1.29-MRK.1.31"], camera: [4, 3, 6], license: "CC0 1.0", sources: ["Modelo de teste do próprio app"], active: true,
  hotspots: [{ id: "porta", label: "A entrada", text: "Pedro e André moravam em Cafarnaum; Jesus curou a sogra de Pedro ali.", refs: ["MRK.1.29-MRK.1.31"], at: [0, 1, 2] }] };

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const admin = await user("admin", "admin"), student = await user("aluno", "student");
  const glb = cubeGlb();
  // ---- permissions ----
  say("permissions: a student cannot add a model (403)", (await student.post(META, glb)).status === 403);
  say("permissions: a student cannot list the admin view (403)", (await student.call("GET", "/visuals/models?admin=1")).status === 403);
  say("permissions: no login is refused for writes (401)", (await fetch(`${BASE}/api/v1/visuals/models`, { method: "POST", body: new FormData() })).status === 401);
  // ---- validation ----
  say("validation: invalid metadata is refused (400)", (await admin.post({ ...META, alt: "curto" }, glb)).status === 400);
  say("validation: a file is required for a new model (400)", (await admin.post(META, null)).status === 400);
  say("validation: a file that is not a GLB is refused (415)", (await admin.post(META, Buffer.from("not a glb file at all"))).status === 415);
  say("validation: a file over 3.5 MB is refused (413)", (await admin.post(META, Buffer.concat([glb, Buffer.alloc(3_600_000)]))).status === 413);
  say("validation: an id used by a built-in model is refused (409)", (await admin.post({ ...META, id: "noah_ark" }, glb)).status === 409);
  say("RA-20: text that shows the face of Jesus is refused (422)", (await admin.post({ ...META, id: "rosto_x", note: "Close no rosto de Jesus, com os olhos e a barba bem visíveis." }, glb)).status === 422);
  say("validation: a bad verse reference is refused (400)", (await admin.post({ ...META, refs: ["Marcos 1:29"] }, glb)).status === 400);
  // ---- add, list, open ----
  const add = await admin.post(META, glb);
  say("admin adds a model with file and hotspots (201)", add.status === 201 && /models3d/.test(add.body.file_url ?? ""), `${add.status} ${JSON.stringify(add.body).slice(0, 120)}`);
  const fileRes = await fetch(add.body.file_url);
  const head = Buffer.from(await fileRes.arrayBuffer()).subarray(0, 4).toString();
  say("the GLB file is served publicly and is a real GLB", fileRes.ok && head === "glTF");
  const list = await (await fetch(`${BASE}/api/v1/visuals/models`)).json();
  const mine = list.models.find((m) => m.id === "casa_de_pedro");
  say("student catalog lists built-in and uploaded models (22 = 20 + 1 test model + any existing)", list.models.filter((m) => m.source === "code").length === 20 && !!mine && mine.source === "upload");
  say("catalog has themes to browse by", list.themes.includes("Jesus e os Evangelhos") && list.themes.length >= 4);
  const full = (await (await fetch(`${BASE}/api/v1/visuals/models?id=casa_de_pedro`)).json()).model;
  say("one uploaded model comes with hotspots, camera, license and sources", full?.hotspots?.length === 1 && full.license === "CC0 1.0" && full.sources.length === 1 && full.camera.length === 3);
  // edit without re-uploading keeps the file
  const edit = await admin.post({ ...META, name: "A casa de Pedro (revisada)" }, null);
  const full2 = (await (await fetch(`${BASE}/api/v1/visuals/models?id=casa_de_pedro`)).json()).model;
  say("editing metadata keeps the file", edit.status === 201 && full2.name.includes("revisada") && full2.file_url === full.file_url);
  // hidden
  await admin.post({ ...META, active: false }, null);
  const hidden = await (await fetch(`${BASE}/api/v1/visuals/models`)).json();
  say("a hidden model does not appear for students", !hidden.models.some((m) => m.id === "casa_de_pedro"));
  say("a hidden model is not served by id (404)", (await fetch(`${BASE}/api/v1/visuals/models?id=casa_de_pedro`)).status === 404);
  const adminView = await admin.call("GET", "/visuals/models?admin=1");
  say("the admin still sees the hidden model", adminView.body.models?.some((m) => m.id === "casa_de_pedro" && m.active === false) && adminView.body.builtin.length === 20);
  await admin.post({ ...META }, null);
  // audit
  const au = await sql(`select action from audit_logs where target='casa_de_pedro' order by created_at`);
  say("every change is audited", au.length >= 3 && au.every((r) => r.action === "model3d_saved"));
  say("a student cannot write directly to the table", (await createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${student.token}` } } }).from("models3d").insert({ id: "hack", name: "x" })).error !== null);
  const stor = await createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${student.token}` } } }).storage.from("models3d").upload("hack.glb", glb, { contentType: "model/gltf-binary" });
  say("a student cannot upload files to the model bucket", !!stor.error);

  // ---- browser: admin form + student catalog ----
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, locale: "pt-BR" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/termos`, { waitUntil: "networkidle" });
  const put = (s) => p.evaluate(async ({ key: k, value }) => { await new Promise((res, rej) => { const r = indexedDB.open("professor-filipe", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, k); tx.oncomplete = () => res(); tx.onerror = () => rej(); }; r.onerror = () => rej(); }); }, { key: `sb-${REF}-auth-token`, value: JSON.stringify(s) });
  await put(admin.session);
  await p.goto(`${BASE}/admin/modelos-3d`, { waitUntil: "networkidle" });
  await p.waitForSelector("text=Modelos adicionados", { timeout: 20000 });
  say("admin page lists the uploaded model", (await p.locator("text=A casa de Pedro").count()) > 0);
  await p.getByRole("button", { name: "Editar" }).first().click();
  await p.getByRole("button", { name: "Ver como o aluno vê" }).click();
  await p.waitForSelector("canvas", { timeout: 20000 });
  await p.waitForTimeout(2500);
  say("admin preview renders the GLB with its hotspot", (await p.locator("button.map-pin").count()) === 1);
  await p.mouse.click(600, 760);
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/m3d-admin.png" });
  // new model form validates before sending
  await p.getByRole("button", { name: "Salvar modelo" }).scrollIntoViewIfNeeded();
  // student
  await put(student.session);
  await p.goto(`${BASE}/visuais`, { waitUntil: "networkidle" });
  await p.waitForSelector("h2:text('Modelos em 3D')", { timeout: 20000 });
  await p.waitForTimeout(1500);
  say("student catalog shows 21 models and a theme filter", (await p.locator("section:has(h2:text('Modelos em 3D')) ul li").count()) === 21 && (await p.getByRole("button", { name: "Todos os temas" }).count()) === 1);
  await p.getByRole("button", { name: "Jesus e os Evangelhos" }).click();
  const jesus = await p.locator("section:has(h2:text('Modelos em 3D')) ul li").count();
  say("filtering by theme narrows the list", jesus >= 6 && jesus < 21, `${jesus}`);
  await p.getByPlaceholder("Buscar modelo").fill("Pedro");
  say("search narrows further", (await p.locator("section:has(h2:text('Modelos em 3D')) ul li").count()) === 1);
  await p.locator("section:has(h2:text('Modelos em 3D')) ul li button").first().click();
  await p.waitForSelector("[role=dialog] canvas", { timeout: 20000 });
  await p.waitForTimeout(2500);
  say("the uploaded model opens in 3D for the student", (await p.locator("[role=dialog] button.map-pin").count()) === 1);
  await p.locator("[role=dialog] button[aria-label='A entrada']").dispatchEvent("click");
  say("its hotspot shows text and verses", (await p.locator("[role=dialog] >> text=sogra de Pedro").count()) > 0 && (await p.locator("[role=dialog] button:has-text('Marcos 1')").count()) > 0);
  say("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  // ---- delete ----
  say("admin deletes the model and its file", (await admin.call("DELETE", "/visuals/models?id=casa_de_pedro")).status === 200 && (await fetch(add.body.file_url.split("?")[0])).status >= 400);
  say("deleted: gone from the catalog", !(await (await fetch(`${BASE}/api/v1/visuals/models`)).json()).models.some((m) => m.id === "casa_de_pedro"));
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  await sql(`delete from models3d where id in ('casa_de_pedro','hack')`).catch(() => undefined);
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
  await browser.close();
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
