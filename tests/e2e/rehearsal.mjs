// Ensaio do sermão end to end (Prompt 2.4): real speech (Piper male voice) -> real transcription (Whisper) -> metrics + feedback by the model.
// Covers consent, plan gate, the analysis (time/parts/pace/crutches/3 strengths/<=3 improvements), the < 1 minute goal, audio deleted by default,
// kept audio on request, comparison of two rehearsals, privacy between users and deletion.
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../../scripts/db.mjs";

const BASE = process.env.APP_URL ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let ok = true;
const say = (n, p, extra = "") => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}${extra ? "  " + extra : ""}`); };
const made = [];

async function user(label, premium = true) {
  const id = randomUUID(), email = `rh-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1984-03-02',false,'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  if (premium) await sql(`insert into entitlements (user_id, entitlement, source) values ('${id}','plan:premium','admin')`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, token: data.session.access_token };
  u.call = async (method, path, body) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  u.post = async (audio, sessionId, keep) => { const f = new FormData(); f.set("audio", new Blob([audio], { type: "audio/webm" }), "r.webm"); f.set("session_id", sessionId); if (keep) f.set("keep", "1"); const t0 = Date.now(); let r; for (let i = 0; i < 3 && !r; i++) r = await fetch(`${BASE}/api/v1/rehearsals`, { method: "POST", headers: { Authorization: `Bearer ${u.token}` }, body: f }).catch(() => null); if (!r) return { status: 0, body: {}, ms: 0 }; return { status: r.status, body: await r.json().catch(() => ({})), ms: Date.now() - t0 }; };
  u.sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
  return u;
}

// ---- real speech: a short sermon said by the Piper male voice, with crutch words, converted to opus at the app's bitrate ----
function speech(name, sentences, speed) {
  const require = createRequire(process.cwd() + "/package.json");
  const sherpa = require("sherpa-onnx-node");
  const d = "models/piper";
  const tts = new sherpa.OfflineTts({ model: { vits: { model: `${d}/pt_BR-faber-medium.onnx`, tokens: `${d}/tokens.txt`, dataDir: `${d}/espeak-ng-data` }, numThreads: 2, provider: "cpu" }, maxNumSentences: 1 });
  const chunks = []; let sr = 22050;
  for (const s of sentences) { const a = tts.generate({ text: s, sid: 0, speed }); sr = a.sampleRate; chunks.push(a.samples, new Float32Array(Math.round(sr * 0.5))); }
  const len = chunks.reduce((n, c) => n + c.length, 0), all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const pcm = Buffer.alloc(len * 2); for (let i = 0; i < len; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(all[i] * 32767))), i * 2);
  mkdirSync("/tmp/rehearsal", { recursive: true });
  writeFileSync(`/tmp/rehearsal/${name}.pcm`, pcm);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(sr), "-ac", "1", "-i", `/tmp/rehearsal/${name}.pcm`, "-c:a", "libopus", "-b:a", "24k", `/tmp/rehearsal/${name}.webm`]);
  return readFileSync(`/tmp/rehearsal/${name}.webm`);
}

const FIRST = [
  "Bom dia, irmãos, né. Hoje eu quero falar sobre uma pergunta que Filipe fez a um homem na estrada: você entende o que está lendo?",
  "A ideia central deste sermão é simples: Deus coloca a pessoa certa no caminho de quem busca a sua palavra.",
  "Primeiro, vejamos que Deus toma a iniciativa. Um anjo do Senhor disse a Filipe: levanta-te e vai para o sul, pelo caminho deserto.",
  "Então Filipe obedeceu, né, sem pedir explicações. Tipo, ele simplesmente foi, e foi assim que encontrou o eunuco etíope.",
  "Segundo, vejamos que a palavra precisa ser explicada. O etíope lia o profeta Isaías, mas dizia: como poderei entender, se alguém não me explicar?",
  "Filipe começou naquela mesma escritura e anunciou a ele a boa notícia de Jesus. Então, tipo, a Bíblia aponta para Cristo.",
  "Concluindo, irmãos, Deus ainda coloca pessoas no caminho de quem busca. Que você seja o Filipe de alguém esta semana. Amém.",
];
const SECOND = [
  "Bom dia, irmãos. Hoje eu quero falar sobre uma pergunta que Filipe fez a um homem na estrada: você entende o que está lendo?",
  "A ideia central deste sermão é simples: Deus coloca a pessoa certa no caminho de quem busca a sua palavra. Guarde esta frase.",
  "Primeiro ponto: Deus toma a iniciativa. Um anjo do Senhor disse a Filipe: levanta-te e vai para o sul, pelo caminho deserto.",
  "Filipe obedeceu sem pedir explicações. Ele simplesmente foi, e assim encontrou o eunuco etíope.",
  "Segundo ponto: a palavra precisa ser explicada. O etíope lia o profeta Isaías, mas dizia: como poderei entender, se alguém não me explicar?",
  "Filipe começou naquela mesma escritura e anunciou a ele a boa notícia de Jesus. A Bíblia inteira aponta para Cristo.",
  "Concluindo, irmãos, Deus ainda coloca pessoas no caminho de quem busca. Que você seja o Filipe de alguém esta semana. Amém.",
];

try {
  const a = await user("pregador"), b = await user("outro"), free = await user("gratuito", false);
  const sess = await a.call("POST", "/sessions", { mode: "sermon", context: { sermon_type: "expositivo", ref_or_theme: "Atos 8:26-40" } });
  console.log("session response:", JSON.stringify(sess.body).slice(0, 200)); const sid = sess.body.id ?? sess.body.sessionId ?? sess.body.session?.id;
  say("setup: sermon session created", !!sid);
  const outline = { title: "Você entende o que lê?", base_text: "ACT.8.26-ACT.8.35", central_idea: "Deus coloca a pessoa certa no caminho de quem busca a sua palavra.", introduction: "A pergunta de Filipe: você entende o que está lendo?", divisions: [{ title: "Deus toma a iniciativa", texts: ["ACT.8.26"], explanation: "O anjo envia Filipe.", illustration: "Um guia que espera no caminho" }, { title: "A palavra precisa ser explicada", texts: ["ACT.8.30"], explanation: "O etíope lia Isaías." }], conclusion: "Seja o Filipe de alguém esta semana.", estimated_minutes: 4 };
  await sql(`insert into sermon_outlines (user_id, session_id, data) values ('${a.id}','${sid}', '${JSON.stringify(outline).replace(/'/g, "''")}'::jsonb)`);

  const audio1 = speech("r1", FIRST, 0.95);
  const audio2 = speech("r2", SECOND, 1.0);
  say("audio: 24 kbps opus keeps a few minutes well under the 4.4 MB limit", audio1.length < 4_400_000, `${Math.round(audio1.length / 1024)} KB`);

  // consent and plan
  say("gate: the free plan cannot rehearse (403 plan_required)", (await free.post(audio1, randomUUID())).status === 403);
  const noConsent = await a.post(audio1, sid);
  say("consent: without the rehearsal consent the API refuses (403 consent_required)", noConsent.status === 403 && noConsent.body.error === "consent_required");
  say("consent: it is recorded with the specific kind", (await a.call("POST", "/consents", { kind: "rehearsal_audio", granted: true })).status === 201);
  say("validation: audio too short is refused", (await a.post(Buffer.alloc(500), sid)).status === 400);

  // first rehearsal (default: audio deleted)
  const r1 = await a.post(audio1, sid, false);
  say("rehearsal 1: analyzed (201)", r1.status === 201, `${r1.status} ${r1.body.error ?? ""}`);
  say("goal: analysis in under 1 minute", r1.ms < 60000, `${(r1.ms / 1000).toFixed(1)} s`);
  const m = r1.body.metrics ?? {};
  say("metrics: total time, words and pace measured", m.total_seconds > 30 && m.words > 80 && m.wpm > 60, `${m.total_seconds}s ${m.words} words ${m.wpm} wpm`);
  say("metrics: crutch words found (né/tipo)", (m.crutches ?? []).some((c) => c.word === "né" || c.word === "tipo"), JSON.stringify(m.crutches ?? []));
  say("parts: time per outline part (4 parts, most found)", (m.parts ?? []).length === 4 && m.parts.filter((p) => p.found).length >= 3, JSON.stringify((m.parts ?? []).map((p) => `${p.key}:${p.seconds}`)));
  const f = r1.body.feedback ?? {};
  say("feedback: 3 strengths and at most 3 concrete improvements", f.strengths?.length === 3 && f.improvements?.length <= 3 && f.improvements?.every((i) => i.what && i.how));
  say("feedback: central idea, transitions, illustrations and fidelity assessed", !!(f.central_idea && f.transitions && f.illustrations && f.fidelity));
  const row1 = (await sql(`select audio_url, length(transcript) as n, user_id from rehearsals where id='${r1.body.id}'`))[0];
  say("privacy: the audio was NOT kept (audio_url empty) and the transcript was", row1.audio_url === null && row1.n > 200 && row1.user_id === a.id);
  const objs = (await sql(`select count(*)::int n from storage.objects where bucket_id='rehearsals' and name like '${a.id}/%'`))[0].n;
  say("privacy: nothing in storage after a default rehearsal", objs === 0);

  // second rehearsal, keeping the audio
  const r2 = await a.post(audio2, sid, true);
  say("rehearsal 2: analyzed and the audio kept on request", r2.status === 201 && r2.body.has_audio === true);
  const got = await a.call("GET", `/rehearsals?id=${r2.body.id}`);
  say("kept audio: a short-lived link is returned", typeof got.body.audio_link === "string" && got.body.audio_link.includes("rehearsals"));
  if (got.body.audio_link) { const au = await fetch(got.body.audio_link); say("kept audio: the link serves the recording", au.ok && Number(au.headers.get("content-length") ?? 0) > 1000); }
  const list = await a.call("GET", `/rehearsals?session_id=${sid}`);
  say("history: both rehearsals listed, newest first, no transcript in the list", list.body.items?.length === 2 && list.body.items[0].id === r2.body.id && list.body.items[0].transcript === undefined);
  const m2 = r2.body.metrics ?? {};
  say("comparison data: second has fewer crutch words than the first", (m2.crutches ?? []).reduce((n, c) => n + (c.flagged ? c.count : 0), 0) <= (m.crutches ?? []).reduce((n, c) => n + (c.flagged ? c.count : 0), 0), `${JSON.stringify(m2.crutches)}`);

  // privacy between users
  say("privacy: another user cannot open the rehearsal (404)", (await b.call("GET", `/rehearsals?id=${r2.body.id}`)).status === 404);
  say("privacy: another user cannot list or delete it", (await b.call("GET", `/rehearsals?session_id=${sid}`)).body.items?.length === 0 && (await b.call("DELETE", `/rehearsals?id=${r2.body.id}`)).status === 404);
  const direct = await b.sb.from("rehearsals").select("id").eq("id", r2.body.id);
  say("privacy: RLS hides it from direct reads too", (direct.data ?? []).length === 0);
  const sbAudio = await b.sb.storage.from("rehearsals").download(`${a.id}/${r2.body.id}.webm`);
  say("privacy: other users cannot download the kept audio", !!sbAudio.error);

  // deletion
  say("delete: removes the rehearsal and the kept audio", (await a.call("DELETE", `/rehearsals?id=${r2.body.id}`)).status === 200 && (await sql(`select count(*)::int n from storage.objects where bucket_id='rehearsals' and name like '${a.id}/%'`))[0].n === 0);
  say("delete: it is gone", (await a.call("GET", `/rehearsals?id=${r2.body.id}`)).status === 404);
  // an outline without content cannot be rehearsed
  const sess2 = await a.call("POST", "/sessions", { mode: "sermon", context: { sermon_type: "expositivo", ref_or_theme: "Salmo 23" } });
  say("no outline yet: asks to fill the outline first (404)", (await a.post(audio1, sess2.body.id ?? sess2.body.sessionId)).status === 404);
} catch (e) {
  ok = false; console.log("ERROR", e);
} finally {
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => undefined);
}
console.log(ok ? "\nALL OK" : "\nSOME FAILED");
process.exit(ok ? 0 : 1);
