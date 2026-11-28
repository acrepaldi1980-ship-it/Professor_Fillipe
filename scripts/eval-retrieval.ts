// Proof that the search really finds what is indexed: every record of the app's own content, a sample of library chunks and Bible windows, and exact verses,
// each looked up through the SAME search the teacher uses. For a chunk the question is its own title (what a student would call it); it must come back in the top 12.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/eval-retrieval.ts [--quick]   (exit code 1 when a threshold is missed)
import { readFileSync } from "node:fs";
import { collectAppContent } from "../lib/appcontent/collect";
import { getVerses, searchChunks } from "../lib/knowledge/search";
import { nsql } from "./neon.mjs";

const QUICK = process.argv.includes("--quick");
const TOP = 12;
// Gentle by default: the databases are free-tier and shared with the live app (a heavy run made the app slow once). One search at a time, with a short pause.
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 1);
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 300);
const results: { name: string; ok: number; total: number; min: number; misses: string[] }[] = [];

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; await fn(x); await new Promise((r) => setTimeout(r, PAUSE_MS)); } }));
}
async function found(query: string, id: string): Promise<boolean> {
  const { chunks } = await searchChunks(query, { maxChunks: TOP, maxTokens: 60000, perSignal: 30 });
  return chunks.some((c) => c.id === id);
}
async function check(name: string, items: { id: string; query: string }[], min: number) {
  const misses: string[] = [];
  await pool(items, CONCURRENCY, async (x) => { if (!(await found(x.query, x.id).catch(() => false))) misses.push(x.id); });
  results.push({ name, ok: items.length - misses.length, total: items.length, min, misses });
  console.log(`${name}: ${items.length - misses.length}/${items.length} (${Math.round(((items.length - misses.length) / items.length) * 100)}%)`);
}

/** Basic questions by NAME ("Me fale tudo sobre Zaqueu"): the people and places of the Bible, asked the way a student asks. The answer must hold a passage that names or covers them. */
async function checkNames() {
  const all = JSON.parse(readFileSync("lib/knowledge/entity-index.json", "utf8")) as { id: string; k: string; en: string; pt: string[]; r: string[] }[];
  const pool0 = all.filter((e) => (e.k === "p" || e.k === "l") && e.pt.length && e.r.length >= 3 && e.pt[0].length >= 4);
  const step = Math.max(1, Math.floor(pool0.length / (QUICK ? 40 : 120)));
  const sample = pool0.filter((_, i) => i % step === 0).slice(0, QUICK ? 40 : 120);
  const TEMPLATES = ["Me fale tudo sobre NAME", "Quem foi NAME?", "NAME", "O que a Bíblia diz sobre NAME"];
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const misses: string[] = [], times: number[] = [];
  let i = 0;
  await pool(sample, CONCURRENCY, async (e) => {
    const name = e.pt[0];
    const q = TEMPLATES[i++ % TEMPLATES.length].replace("NAME", name);
    const t0 = Date.now();
    const { chunks } = await searchChunks(q, { maxChunks: TOP, maxTokens: 60000, perSignal: 30 }).catch(() => ({ chunks: [] as { text: string; refs: string[]; signals?: string[] }[] }));
    times.push(Date.now() - t0);
    const refs = new Set(e.r);
    // "exact" and "title" signals mean the entity's own verses or its dictionary entry were found (the Bibles may spell the name differently: Hete/Hitita)
    const ok = chunks.some((c) => c.signals?.some((x) => x === "exact" || x === "title") || norm(c.text).includes(norm(name)) || norm(c.text).includes(norm(e.en)) || (c.refs ?? []).some((r) => refs.has(r)));
    if (!ok) misses.push(`${q}`);
  });
  results.push({ name: "basic questions by name (people and places)", ok: sample.length - misses.length, total: sample.length, min: 0.95, misses });
  console.log(`names: ${sample.length - misses.length}/${sample.length}`);
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0, p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  console.log(`search time: p50 ${p50} ms, p95 ${p95} ms`);
  results.push({ name: "search speed (p95 under 6 s)", ok: p95 <= 6000 ? 1 : 0, total: 1, min: 1, misses: p95 > 6000 ? [`p95 ${p95} ms`] : [] });
}

async function main() {
  await checkNames();
  // 1) the app's own content: every record, asked by its title (a student names the character, the place, the object...)
  const app = collectAppContent();
  await check("app content (every record, by title)", (QUICK ? app.slice(0, 60) : app).map((r) => ({ id: r.id, query: r.title.replace(/^.*> /, "") })), 0.9);

  // 2) library chunks of every database: a random sample by its own title
  // the core search tables (Bible windows and Easton) live on Neon since 28/11/2026 (shard 2: NEON_SHARD=2)
  const lib = await nsql("select id, title_path from core_chunks where title_path is not null order by random() limit 60");
  await check("main database chunks (Bible windows, dictionary)", lib.map((r: Record<string, string>) => ({ id: r.id, query: r.title_path.split(">").pop()!.trim() })), 0.7);

  // 3) exact verses: a random sample of (version, reference) must come back with text
  const verses: { version_id: string; ref: string }[] = [];
  for (let i = 0; i < (QUICK ? 40 : 150); i++) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bible_verses?select=version_id,ref&limit=1&offset=${Math.floor(Math.random() * 700000)}`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } });
    const row = ((await res.json().catch(() => [])) as { version_id: string; ref: string }[])[0];
    if (row) verses.push(row);
  }
  let missing = 0;
  await pool(verses as Record<string, string>[], CONCURRENCY, async (v) => { const r = await getVerses(v.version_id, [v.ref]).catch(() => []); if (!r.some((x) => x.ref === v.ref && x.text)) missing++; });
  results.push({ name: "exact verses", ok: verses.length - missing, total: verses.length, min: 1, misses: [] });
  console.log(`exact verses: ${verses.length - missing}/${verses.length}`);

  let failed = false;
  console.log("");
  for (const r of results) {
    const pass = r.ok / r.total >= r.min;
    if (!pass) failed = true;
    console.log(`${pass ? "PASS" : "FAIL"}  ${r.name}: ${Math.round((r.ok / r.total) * 100)}% (minimum ${Math.round(r.min * 100)}%)${r.misses.length ? `  e.g. ${r.misses.slice(0, 4).join(", ")}` : ""}`);
  }
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(1); });
