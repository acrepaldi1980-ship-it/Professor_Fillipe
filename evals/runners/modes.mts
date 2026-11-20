// Runs the `modes` evals end to end with a scripted student (spec 16.1): 4 lessons, 4 sermons, 4 deepenings, against a deployment.
// Checks the plumbing and the rules that do not need a judge: RA-10 (a sermon part enters only after approval), completeness within
// the allowed exchanges, word limits and that the deepening uses the original-language words. Usage: tsx evals/runners/modes.ts [--limit N]
import { readFileSync, writeFileSync } from "node:fs";
import { sql } from "../../scripts/db.mjs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { lessonGaps, LessonPlan, SermonOutline, sermonGaps } from "../../lib/modes/schema";

const BASE = process.env.BASE_URL ?? "https://professor-filipe.vercel.app/api/v1";
interface Case { id: string; mode: "lesson" | "sermon" | "deep"; context: Record<string, unknown>; turns: number; expect: string }
const cases = (JSON.parse(readFileSync("evals/datasets/modes.json", "utf8")) as Case[]).slice(0, Number(process.argv[process.argv.indexOf("--limit") + 1]) || 99);

const email = `modes-eval-${Date.now()}@example.test`, password = `Tt!${randomUUID()}`, uid = randomUUID();
const rows: string[] = [];
try {
  await sql(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values ('${uid}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}', crypt('${password}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '')`);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.auth.signInWithPassword({ email, password });
  const H = { Authorization: `Bearer ${data.session!.access_token}`, "Content-Type": "application/json" };
  await fetch(`${BASE}/me`, { method: "PUT", headers: H, body: JSON.stringify({ display_name: "Marcos", preferred_name: "Marcos", birth_date: "1984-03-02" }) });
  for (const c of cases) {
    const { sessionId } = (await (await fetch(`${BASE}/sessions`, { method: "POST", headers: H, body: JSON.stringify({ mode: c.mode, context: c.context }) })).json()) as { sessionId: string };
    const say = async (text: string) => {
      const res = await fetch(`${BASE}/teacher/turn`, { method: "POST", headers: H, body: JSON.stringify({ sessionId, text }) });
      const body = await res.text();
      const s = /event: structured\ndata: (.+)/.exec(body)?.[1];
      return s ? (JSON.parse(s) as { speech: string; display_markdown: string }) : null;
    };
    const getDoc = async () => ((await (await fetch(`${BASE}/sessions/${sessionId}/document`, { headers: H })).json()) as { doc: Record<string, unknown> | null }).doc ?? {};
    let ra10 = true, overLimit = 0, answers = 0, usedOriginal = false;
    if (c.mode === "sermon") {
      // RA-10: asking for ideas without approving must not write anything into the outline.
      await say("Me dê ideias de ideia central, ainda não decidi.");
      ra10 = Object.keys(await getDoc()).filter((k) => k !== "type").length === 0;
    }
    const script = c.mode === "deep" ? ["Pode começar a análise.", "Quais as palavras-chave no original?", "Como as tradições leem esse texto?"] : Array.from({ length: c.turns }, (_, i) => (i === 0 ? "Vamos começar. Me proponha o primeiro passo." : "Sim, pode colocar isso e seguir para o próximo passo."));
    for (const text of script) {
      const r = await say(text);
      if (!r) continue;
      answers++;
      const limit = c.mode === "deep" ? 250 : 120;
      if (r.speech.split(/\s+/).length > limit) overLimit++;
      if (c.mode === "deep" && /strong|G\d{3,4}|lema|original|grego|hebraico/i.test(`${r.speech} ${r.display_markdown}`)) usedOriginal = true;
    }
    const doc = await getDoc();
    const gaps = c.mode === "lesson" ? lessonGaps(LessonPlan.parse(doc)) : c.mode === "sermon" ? sermonGaps(SermonOutline.parse(doc)) : [];
    const pass = c.mode === "deep" ? usedOriginal && overLimit === 0 : ra10 && gaps.length <= 2 && overLimit <= 1;
    rows.push(`| ${c.id} | ${c.mode} | ${answers}/${script.length} | ${c.mode === "sermon" ? (ra10 ? "sim" : "NÃO") : "—"} | ${gaps.length ? gaps.join(" ") : "completo"} | ${overLimit} | ${pass ? "PASSA" : "FALHA"} |`);
    console.log(rows[rows.length - 1]);
  }
} finally {
  await sql(`delete from auth.users where id='${uid}'`).catch(() => undefined);
}
const date = new Date().toISOString().slice(0, 10);
writeFileSync(`evals/reports/${date}-modes.md`, `# Evals dos modos — ${date}\n\n| Caso | Modo | Respostas | RA-10 ok | Lacunas | Falas acima do limite | Resultado |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`);
