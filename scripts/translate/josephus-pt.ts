// Translates Josephus into Portuguese with the Claude Message Batches API (50% cheaper, results within hours), keeps every answer on disk (resumable) and
// writes the sections to the database. Needs credit on the Anthropic account.
//
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/translate/josephus-pt.ts <step> [--model claude-sonnet-5-5] [--limit N] [--work ant]
//   plan    -> counts requests and estimates tokens and cost (no calls)
//   submit  -> sends the batches (records their ids in data/translate/josephus/state.json)
//   collect -> waits for the batches, reads the results, redoes what failed
//   apply   -> writes text_pt and title_pt in the database
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pack, parse, render, SYSTEM, type Sec } from "../../lib/josephus/translate";
import { nsql } from "../neon.mjs";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const step = process.argv[2] ?? "plan";
const MODEL = arg("--model") ?? "claude-sonnet-5-5";
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
  const rows = (await nsql("select work, book, chapter, n, text from josephus_sections where text_pt is null order by work, book, chapter, n")) as { work: string; book: number; chapter: number; n: number; text: string }[];
  const by = new Map<string, Sec[]>();
  for (const r of rows) { if (ONLY && r.work !== ONLY) continue; (by.get(`${r.work}.${r.book}.${r.chapter}`) ?? by.set(`${r.work}.${r.book}.${r.chapter}`, []).get(`${r.work}.${r.book}.${r.chapter}`)!).push({ n: r.n, text: r.text }); }
  const out: { id: string; secs: Sec[] }[] = [];
  for (const [k, secs] of by) pack(secs).forEach((u, i) => out.push({ id: `${k}.u${i}`, secs: u }));
  const titles = (await nsql("select work, book, chapter, title from josephus_chapters where title <> '' and title_pt is null")) as { work: string; book: number; chapter: number; title: string }[];
  const tsecs: Sec[] = titles.filter((t) => !ONLY || t.work === ONLY).map((t, i) => ({ n: i + 1, text: `${t.work}.${t.book}.${t.chapter} || ${t.title}` }));
  for (let i = 0; i < tsecs.length; i += 60) out.push({ id: `titles.${i / 60}`, secs: tsecs.slice(i, i + 60) });
  return out.slice(0, LIMIT);
}

async function main() {
  const all = await units();
  const words = all.reduce((t, u) => t + u.secs.reduce((a, s) => a + s.text.split(/\s+/).length, 0), 0);
  const [pi, po] = PRICE[MODEL] ?? PRICE["claude-sonnet-5-5"];
  const inTok = words * 1.35 + all.length * 450, outTok = words * 1.7;
  const cost = (inTok / 1e6) * pi + (outTok / 1e6) * po;
  if (step === "plan") { console.log(`${all.length} requests, ${words} English words, ~${Math.round(inTok / 1000)}k input and ~${Math.round(outTok / 1000)}k output tokens; ${MODEL}: ~US$ ${cost.toFixed(2)} (batch: ~US$ ${(cost / 2).toFixed(2)})`); return; }
  const client = new Anthropic();
  const st = load();
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
      if (u.id.startsWith("titles.")) {
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
