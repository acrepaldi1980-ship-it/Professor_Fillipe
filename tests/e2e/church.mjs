// Plano Igreja end to end (Prompt 2.2): a simulated church with 2 classes and 10 students, through the real API. Covers creating the church,
// payment (simulated provider) opening the plan, invite codes, joining, the student limit, access rights from the church, the lesson of the week,
// a study session linked to the lesson, the teacher panel (aggregates only, hidden under 5 students) and the PRIVACY tests.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sql } from "../../scripts/db.mjs";

const BASE = process.env.APP_URL ?? "http://localhost:3100";
let ok = true;
const say = (n, p) => { if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"}  ${n}`); };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const made = [];
async function user(label, minor = false) {
  const id = randomUUID(), email = `ch-${label}-${Date.now()}@example.test`, pw = `Tt!${randomUUID()}`;
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', extensions.crypt('${pw}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  await sql(`insert into profiles (user_id, display_name, preferred_name, birth_date, is_minor, level, level_score) values ('${id}','${label}','${label}','1990-01-01',${minor},'intermediário',50)`);
  await sql(`insert into consent_records (user_id, kind, version, granted) values ('${id}','terms','t',true),('${id}','privacy','t',true),('${id}','sensitive_religious','t',false)`);
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email, password: pw });
  made.push(id);
  const u = { id, token: data.session.access_token };
  u.call = async (method, path, body) => { const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: r.status === 204 ? {} : await r.json().catch(() => ({})) }; };
  u.sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
  return u;
}

try {
  const admin = await user("admin"), prof1 = await user("prof1"), prof2 = await user("prof2");
  const students = [];
  for (let i = 1; i <= 10; i++) students.push(await user(`aluno${i}`));
  const outsider = await user("fora");

  // ---- church, plan and payment ----
  const created = await admin.call("POST", "/church", { name: "Igreja Teste", plan: "church_30" });
  say("church: the administrator creates it (201)", created.status === 201);
  const cid = created.body.id;
  const mine0 = (await admin.call("GET", "/church")).body.churches[0];
  say("church: starts pending payment, administrator role, teacher code visible only to the administrator", mine0.status === "pending" && mine0.role === "admin" && /^T/.test(mine0.teacher_code) && mine0.student_limit === 30);
  const tcode = (await admin.call("GET", "/church")).body.churches[0].teacher_code;
  const j1 = await prof1.call("POST", "/church/join", { code: tcode });
  const j2 = await prof2.call("POST", "/church/join", { code: tcode });
  say("teachers: join with the teacher code", j1.status === 200 && j1.body.role === "teacher" && j2.body.role === "teacher");
  const cls1 = (await admin.call("POST", "/church/classes", { churchId: cid, name: "Jovens", ageGroup: "youth", teacherId: prof1.id })).body.id;
  say("classes: the administrator creates a class with a teacher of the church", !!cls1);
  say("classes: the teacher must belong to the church (400)", (await admin.call("POST", "/church/classes", { churchId: cid, name: "Intrusa", teacherId: outsider.id })).status === 400);
  const cls2 = (await admin.call("POST", "/church/classes", { churchId: cid, name: "Adultos", ageGroup: "adults", teacherId: prof2.id })).body.id;
  const cls1b = (await admin.call("GET", "/church")).body.churches[0].classes;
  const code1 = cls1b.find((k) => k.id === cls1).invite_code, code2 = cls1b.find((k) => k.id === cls2).invite_code;
  say("classes: two classes with their own invite codes", /^C/.test(code1) && /^C/.test(code2) && code1 !== code2);
  say("teacher 2 sees only their class, not the other teacher's invite code", (await prof2.call("GET", "/church")).body.churches[0].classes.map((k) => k.id).join() === cls2);

  // payment: simulated provider confirms -> church active -> rights for the members
  const co = await admin.call("POST", "/church/checkout", { churchId: cid, cycle: "month", method: "pix" });
  say("payment: checkout of the church plan returns the amount of the plan (R$ 199)", co.status === 200 && co.body.amount === 199);
  const ref = (await sql(`select provider_ref from subscriptions where church_id='${cid}'`))[0]?.provider_ref;
  say("payment: the subscription is linked to the church (no access yet)", !!ref && (await sql(`select status from churches where id='${cid}'`))[0].status === "pending");
  const sim = await admin.call("POST", "/billing/simulate", { ref, event: "PAYMENT_CONFIRMED" });
  const chRow = (await sql(`select status from churches where id='${cid}'`))[0];
  say("payment: confirmed -> the church becomes active", sim.status === 200 && chRow.status === "active");

  // ---- students join ----
  for (let i = 0; i < 6; i++) await students[i].call("POST", "/church/join", { code: code1 });
  for (let i = 6; i < 10; i++) await students[i].call("POST", "/church/join", { code: code2 });
  const st1 = (await students[0].call("GET", "/church")).body.churches[0];
  say("students: join with the class code and see only their own class, without codes", st1.role === "student" && st1.classes.length === 1 && st1.classes[0].invite_code === null && st1.teacher_code === null);
  say("students: a wrong code is refused (404)", (await outsider.call("POST", "/church/join", { code: "CZZZZZZZZZ" })).status === 404);
  const ents = await sql(`select entitlement, source from entitlements where user_id='${students[0].id}' and source='church' and status='active'`);
  const entT = await sql(`select entitlement from entitlements where user_id='${prof1.id}' and source='church' and status='active'`);
  say("rights: students get Plus and teachers Premium from the church", ents[0]?.entitlement === "plan:plus" && entT[0]?.entitlement === "plan:premium");
  say("rights: the outsider has none", (await sql(`select count(*)::int n from entitlements where user_id='${outsider.id}' and source='church'`))[0].n === 0);

  // ---- the student limit ----
  await sql(`update plans set limits = '{"students":10}' where id='church_30'`);
  const full = await outsider.call("POST", "/church/join", { code: code1 });
  await sql(`update plans set limits = '{"students":30}' where id='church_30'`);
  say("limit: the 11th student is refused when the plan is full (409)", full.status === 409);

  // ---- lesson of the week ----
  const lp = await prof1.call("POST", "/church/lessons", { classId: cls1, title: "Filipe e o eunuco etíope", ref: "Atos 8:26-40", notes: "Foquem em como Filipe começa pela pergunta." });
  say("lessons: the class teacher publishes the lesson", lp.status === 201);
  say("lessons: a teacher of another class cannot publish (403)", (await prof2.call("POST", "/church/lessons", { classId: cls1, title: "Intruso" })).status === 403);
  say("lessons: a student cannot publish (403)", (await students[0].call("POST", "/church/lessons", { classId: cls1, title: "Aluno" })).status === 403);
  const mineL = (await students[0].call("GET", "/church/lessons")).body.lessons;
  say("lessons: the student sees it on the home list; the other class does not", mineL.length === 1 && mineL[0].title.startsWith("Filipe") && (await students[7].call("GET", "/church/lessons")).body.lessons.length === 0);

  // ---- a study session linked to the lesson ----
  const lessonId = lp.body.id;
  const sess = await students[0].call("POST", "/sessions", { mode: "free", churchLessonId: lessonId });
  const srow = (await sql(`select church_lesson_id, context from sessions where id='${sess.body.sessionId}'`))[0];
  say("study: opening the lesson creates a session linked to it, with the teacher's notes in the context", sess.status === 201 && srow.church_lesson_id === lessonId && srow.context.church_lesson?.notes?.includes("pergunta"));
  say("study: a student of another class cannot open that lesson (404)", (await students[8].call("POST", "/sessions", { mode: "free", churchLessonId: lessonId })).status === 404);

  // ---- teacher panel: aggregates only, hidden under 5 ----
  const s0 = await prof1.call("GET", `/church/stats?classId=${cls1}`);
  say("panel: with fewer than 5 students taking part, no number is shown", s0.status === 200 && s0.body.enough === false && s0.body.studied === null && s0.body.topics.length === 0);
  for (let i = 1; i < 6; i++) {
    const s = await students[i].call("POST", "/sessions", { mode: "free", churchLessonId: lessonId });
    const sid = s.body.sessionId;
    await sql(`insert into session_closings (session_id, summary, mind_map, topics) values ('${sid}','Resumo','{"nodes":[],"edges":[]}'::jsonb, ARRAY['Atos 8','Batismo'])`);
  }
  await sql(`insert into session_closings (session_id, summary, mind_map, topics) values ('${sess.body.sessionId}','Resumo','{"nodes":[],"edges":[]}'::jsonb, ARRAY['Atos 8'])`);
  const s1 = await prof1.call("GET", `/church/stats?classId=${cls1}`);
  if (s1.body.enough !== true || s1.body.studied !== 6) console.log("   stats:", JSON.stringify(s1.body));
  say("panel: with 6 students taking part it shows how many studied and the topics shared by at least 3", s1.body.enough === true && s1.body.studied === 6 && s1.body.topics.some((t) => t.topic === "Atos 8" && t.students === 6));
  say("panel: the answer holds only numbers and topics (no names, ids or text)", !/aluno\d|@example|user_id|text|message/i.test(JSON.stringify(s1.body)));
  say("panel: a teacher of another class cannot read it (403)", (await prof2.call("GET", `/church/stats?classId=${cls1}`)).status === 403);
  say("panel: a student cannot read it (403)", (await students[0].call("GET", `/church/stats?classId=${cls1}`)).status === 403);

  // ---- PRIVACY: the EBD teacher and the church never read a student's conversation ----
  await sql(`insert into messages (session_id, role, text) values ('${sess.body.sessionId}','user','Tenho uma dúvida pessoal muito privada sobre a minha família')`);
  const readMsgs = await prof1.sb.from("messages").select("id, text");
  say("privacy: the class teacher cannot read any message (RLS)", (readMsgs.data ?? []).length === 0);
  const adminMsgs = await admin.sb.from("messages").select("id");
  say("privacy: the church administrator cannot read messages either", (adminMsgs.data ?? []).length === 0);
  const readSess = await prof1.sb.from("sessions").select("id").eq("user_id", students[0].id);
  say("privacy: the teacher cannot list a student's sessions or summaries", (readSess.data ?? []).length === 0 && ((await prof1.sb.from("session_closings").select("session_id")).data ?? []).length === 0 && ((await prof1.sb.from("notebook_items").select("id")).data ?? []).length === 0);
  const readProf = await prof1.sb.from("profiles").select("user_id").neq("user_id", prof1.id);
  say("privacy: the teacher cannot read other people's profiles", (readProf.data ?? []).length === 0);
  const members = await prof1.sb.from("class_members").select("user_id");
  say("privacy: the teacher sees only who belongs to their own class (no activity)", (members.data ?? []).length === 6);
  say("privacy: a student cannot see the other students of the class", ((await students[0].sb.from("class_members").select("user_id")).data ?? []).length === 1);
  say("privacy: a stranger sees no church data at all", ((await outsider.sb.from("churches").select("id")).data ?? []).length === 0 && ((await outsider.sb.from("church_lessons").select("id")).data ?? []).length === 0);
  const write = await prof1.sb.from("classes").update({ name: "Hackeada" }).eq("id", cls1).select();
  say("privacy: nobody writes church tables directly (only through the checked functions)", (write.data ?? []).length === 0);

  // ---- leaving and the end of the plan ----
  const leave = await students[5].call("POST", "/church/leave", { churchId: cid });
  say("leaving: the student leaves and the rights from the church end at once", leave.status === 204 && (await sql(`select count(*)::int n from entitlements where user_id='${students[5].id}' and source='church' and status='active'`))[0].n === 0);
  say("leaving: the administrator cannot leave (409)", (await admin.call("POST", "/church/leave", { churchId: cid })).status === 409);
  // cancelling keeps access until the end of the paid period; when the period ends, the daily job closes the church and the members' rights
  await admin.call("POST", "/billing/simulate", { ref, event: "SUBSCRIPTION_DELETED" });
  say("plan end: cancelling keeps the church active until the end of the paid period", (await sql(`select status from churches where id='${cid}'`))[0].status === "active" && (await sql(`select count(*)::int n from entitlements where user_id='${students[0].id}' and source='church' and status='active'`))[0].n === 1);
  await sql(`update subscriptions set current_period_end = now() - interval '1 day' where church_id='${cid}'`);
  await sql("select * from billing_daily_tick()");
  const after = (await sql(`select status from churches where id='${cid}'`))[0].status;
  const left = (await sql(`select count(*)::int n from entitlements where user_id='${students[0].id}' and source='church' and status='active'`))[0].n;
  say("plan end: when the period ends the church is suspended and every member loses the church rights", after === "suspended" && left === 0);
} catch (e) {
  console.log("E2E ERROR:", e.message.slice(0, 500));
  ok = false;
} finally {
  await sql(`delete from payment_events where provider = 'simulated'`).catch(() => {});
  await sql(`delete from subscriptions where church_id in (select id from churches where admin_user_id = any(array[${made.map((m) => `'${m}'`).join(",")}]::uuid[]))`).catch(() => {});
  await sql(`delete from churches where admin_user_id = any(array[${made.map((m) => `'${m}'`).join(",")}]::uuid[])`).catch(() => {});
  await sql(`update plans set limits = '{"students":30}' where id='church_30'`).catch(() => {});
  for (const id of made) await sql(`delete from auth.users where id='${id}'`).catch(() => {});
}
process.exit(ok ? 0 : 1);
