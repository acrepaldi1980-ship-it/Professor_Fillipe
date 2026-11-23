// Translates Josephus into Portuguese, keeps every answer on disk (resumable) and writes the sections to the database. Providers:
//   anthropic (default): the Claude Message Batches API, 50% cheaper, results within hours; needs credit on the Anthropic account.
//   mistral / gemini:    direct calls at a gentle pace, on the free plans (Mistral "Experiment": about 1 request per second; Gemini free tier: a daily quota).
//
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/translate/josephus-pt.ts <step> [--provider anthropic|mistral|gemini] [--model ...] [--limit N] [--work ant]
//   plan    -> counts requests and estimates tokens and cost (no calls)
//   submit  -> (anthropic) sends the batches; collect -> waits and reads them
//   run     -> (mistral, gemini) translates unit by unit; stops cleanly on a daily limit and resumes later
//   apply   -> writes text_pt and title_pt in the database (Josephus and, with --work hist, the historians' books)
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pack, parse, render, SYSTEM, type Sec } from "../../lib/josephus/translate";
import { nsql } from "../neon.mjs";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const step = process.argv[2] ?? "plan";
const PROVIDER = arg("--provider") ?? "anthropic";
const MODEL = arg("--model") ?? (PROVIDER === "mistral" ? "mistral-large-latest" : PROVIDER === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-5-5");
const LIMIT = Number(arg("--limit") ?? 1e9);
const ONLY = arg("--work");
const DIR = "data/translate/josephus";
const STATE = `${DIR}/state.json`;
const PRICE: Record<string, [number, number]> = { "claude-haiku-5-5": [0.1, 0.5], "claude-sonnet-5-5": [2, 10], "claude-opus-5-5": [4, 20] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
interface State { batches: { id: string; ids: string[] }[]; done: Record<string, string> }
const load = (): State => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { batches: [], done: {} });
const save = (s: State) => { mkdirSync(DIR, { recursive: true }); writeFileSync(STATE, JSON.stringify(s)); };

async function units() {
  const rows = ONLY === "hist" ? [] : (await nsql("select work, book, chapter, n, text from josephus_sections where text_pt is null order by work, book, chapter, n")) as { work: string; book: number; chapter: number; n: number; text: string }[];
  const by = new Map<string, Sec[]>();
  for (const r of rows) { if (ONLY && r.work !== ONLY) continue; (by.get(`${r.work}.${r.book}.${r.chapter}`) ?? by.set(`${r.work}.${r.book}.${r.chapter}`, []).get(`${r.work}.${r.book}.${r.chapter}`)!).push({ n: r.n, text: r.text }); }
  const out: { id: string; secs: Sec[] }[] = [];
  for (const [k, secs] of by) pack(secs).forEach((u, i) => out.push({ id: `${k}.u${i}`, secs: u }));
  const titles = (await nsql("select work, book, chapter, title from josephus_chapters where title <> '' and title_pt is null")) as { work: string; book: number; chapter: number; title: string }[];
  const tsecs: Sec[] = titles.filter((t) => !ONLY || t.work === ONLY).map((t, i) => ({ n: i + 1, text: `${t.work}.${t.book}.${t.chapter} || ${t.title}` }));
  for (let i = 0; i < tsecs.length; i += 60) out.push({ id: `titles.${i / 60}`, secs: tsecs.slice(i, i + 60) });
  // the historians' books (hist_units): a unit is translated whole, cut into paragraph packs only when it is long
  if (!ONLY || ONLY === "hist") {
    const hu = (await nsql("select work, ord, text, title from hist_units where text_pt is null order by work, ord")) as { work: string; ord: number; text: string; title: string }[];
    for (const u of hu) pack(u.text.split(/\n\s*\n/).map((p, i) => ({ n: i + 1, text: p }))).forEach((pk, i) => out.push({ id: `h.${u.work}.${u.ord}.u${i}`, secs: pk }));
    // titles are queued on their own: a unit whose text is already translated still needs its title
    const ht = (await nsql("select work, ord, title from hist_units where title <> '' and title_pt is null order by work, ord")) as { work: string; ord: number; title: string }[];
    for (let i = 0; i < ht.length; i += 60) out.push({ id: `htitles.${i / 60}`, secs: ht.slice(i, i + 60).map((u, k) => ({ n: k + 1, text: `${u.work}.${u.ord} || ${u.title}` })) });
  }
  return out.slice(0, LIMIT);
}

async function main() {
  const all = await units();
  const words = all.reduce((t, u) => t + u.secs.reduce((a, s) => a + s.text.split(/\s+/).length, 0), 0);
  const [pi, po] = PRICE[MODEL] ?? PRICE["claude-sonnet-5-5"];
  const inTok = words * 1.35 + all.length * 450, outTok = words * 1.7;
  const cost = (inTok / 1e6) * pi + (outTok / 1e6) * po;
  if (step === "plan") { console.log(`${all.length} requests, ${words} English words, ~${Math.round(inTok / 1000)}k input and ~${Math.round(outTok / 1000)}k output tokens; ${MODEL}: ~US$ ${cost.toFixed(2)} (batch: ~US$ ${(cost / 2).toFixed(2)})`); return; }
  const st = load();
  if (step === "run" && PROVIDER === "local") {
    // Free local machine translation (scripts/translate/mt-local.py): no key, no quota. Exports the pending requests, runs the worker, merges its answers.
    const todo = all.filter((u) => !st.done[u.id]);
    const inF = `${DIR}/mt-in.jsonl`, outF = `${DIR}/mt-out.jsonl`;
    mkdirSync(DIR, { recursive: true });
    writeFileSync(inF, todo.map((u) => JSON.stringify({ id: u.id, secs: u.secs })).join("\n") + "\n");
    console.log(`${todo.length} requests to translate locally`);
    const { spawnSync } = await import("node:child_process");
    spawnSync(process.env.MT_PYTHON ?? "/opt/mt/bin/python", ["scripts/translate/mt-local.py", inF, outF], { stdio: "inherit" });
    let merged = 0, bad = 0;
    if (existsSync(outF)) for (const line of readFileSync(outF, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line) as { id: string; answer: string }; const u = all.find((x) => x.id === r.id);
      if (!u || st.done[u.id]) continue;
      if (parse(r.answer, u.secs)) { st.done[u.id] = r.answer; merged++; } else bad++;
    }
    save(st); console.log(`merged ${merged} answers (${bad} did not match the markers); ${Object.keys(st.done).length} in total`);
    return;
  }
  if (step === "run") {
    // the key is never in the code: Gemini reads GEMINI_TRANSLATE_KEY (a free key from a project WITHOUT billing); Mistral gets it from the credential proxy
    const call = async (user: string): Promise<{ text?: string; stop?: "limit" | "retry"; wait?: number }> => {
      const res = PROVIDER === "mistral"
        ? await fetch("https://api.mistral.ai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer proxy-injected" }, body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 8000, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }) })
        : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_TRANSLATE_KEY ?? "proxy-injected" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8000 } }) });
      if (res.status === 429 || res.status >= 500) { const ra = Number(res.headers.get("retry-after")) || 20; const body = await res.text(); return { stop: /per.?day|daily|quota/i.test(body) && res.status === 429 && ra > 300 ? "limit" : "retry", wait: ra }; }
      if (!res.ok) throw new Error(`${PROVIDER} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return { text: j.choices?.[0]?.message?.content ?? j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") };
    };
    const todo = all.filter((u) => !st.done[u.id]);
    let n = 0;
    for (const u of todo) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const r = await call(render(u.secs));
        if (r.stop === "limit") { console.log(`daily limit reached after ${n} units; run again later`); save(st); return; }
        if (r.stop === "retry") { await sleep((r.wait ?? 20) * 1000); continue; }
        if (r.text && parse(r.text, u.secs)) { st.done[u.id] = r.text; n++; break; }
        console.log(`${u.id}: answer did not match the markers, trying again`);
      }
      save(st);
      if (n % 20 === 0) console.log(`${n}/${todo.length} units translated`);
      await sleep(PROVIDER === "mistral" ? 1100 : 4500);
    }
    console.log(`done: ${n} units this run, ${Object.keys(st.done).length} in total`);
    return;
  }
  const client = new Anthropic();
  if (step === "submit") {
    const todo = all.filter((u) => !st.done[u.id] && !st.batches.some((b) => b.ids.includes(u.id)));
    for (let i = 0; i < todo.length; i += 400) {
      const part = todo.slice(i, i + 400);
      const b = await client.messages.batches.create({ requests: part.map((u) => ({ custom_id: u.id, params: { model: MODEL, max_tokens: 8000, system: SYSTEM, output_config: { effort: "low" }, messages: [{ role: "user" as const, content: render(u.secs) }] } })) });
      st.batches.push({ id: b.id, ids: part.map((u) => u.id) }); save(st);
      console.log(`batch ${b.id}: ${part.length} requests`);
    }
    return;
  }
  if (step === "collect") {
    for (const b of st.batches) {
      for (;;) { const cur = await client.messages.batches.retrieve(b.id); if (cur.processing_status === "ended") break; console.log(`${b.id}: ${cur.request_counts.processing} still processing`); await sleep(60000); }
      for await (const r of await client.messages.batches.results(b.id)) {
        if (r.result.type !== "succeeded") { console.log(`${r.custom_id}: ${r.result.type}`); continue; }
        const text = r.result.message.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
        const u = all.find((x) => x.id === r.custom_id);
        if (u && parse(text, u.secs)) st.done[r.custom_id] = text; else console.log(`${r.custom_id}: answer did not match the markers (redo with submit)`);
      }
      save(st);
    }
    console.log(`${Object.keys(st.done).length} units translated`);
    return;
  }
  if (step === "apply") {
    let sections = 0, titles = 0;
    for (const u of all) {
      const text = st.done[u.id]; if (!text) continue;
      const map = parse(text, u.secs); if (!map) continue;
      if (u.id.startsWith("h.")) {
        const [, w, o] = u.id.split(".");
        const packs = all.filter((x) => x.id.startsWith(`h.${w}.${o}.u`));
        if (packs[0].id !== u.id || !packs.every((x) => st.done[x.id] && parse(st.done[x.id], x.secs))) continue; // a unit is written once, when all its packs are translated
        const piece = packs.map((x) => [...parse(st.done[x.id], x.secs)!.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).join("\n\n")).join("\n\n");
        await nsql("update hist_units set text_pt = $3 where work = $1 and ord = $2", [w, Number(o), piece]); sections++;
      } else if (u.id.startsWith("htitles.")) {
        for (const [n, pt] of map) { const [key] = u.secs.find((s) => s.n === n)!.text.split(" || "); const [w, o] = key.split("."); await nsql("update hist_units set title_pt = $3 where work = $1 and ord = $2", [w, Number(o), pt.replace(/^[^|]*\|\|\s*/, "")]); titles++; }
      } else if (u.id.startsWith("titles.")) {
        for (const [n, pt] of map) { const [key] = u.secs.find((s) => s.n === n)!.text.split(" || "); const [w, b, c] = key.split("."); await nsql("update josephus_chapters set title_pt = $4 where work = $1 and book = $2 and chapter = $3", [w, Number(b), Number(c), pt.replace(/^[^|]*\|\|\s*/, "")]); titles++; }
      } else {
        const [w, b, c] = u.id.split(".");
        for (const [n, pt] of map) { await nsql("update josephus_sections set text_pt = $5 where work = $1 and book = $2 and chapter = $3 and n = $4", [w, Number(b), Number(c), n, pt]); sections++; }
      }
    }
    console.log(`applied: ${sections} sections, ${titles} chapter titles`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
