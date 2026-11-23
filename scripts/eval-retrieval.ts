// Proof that the search really finds what is indexed: every record of the app's own content, a sample of library chunks and Bible windows, and exact verses,
// each looked up through the SAME search the teacher uses. For a chunk the question is its own title (what a student would call it); it must come back in the top 12.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/eval-retrieval.ts [--quick]   (exit code 1 when a threshold is missed)
import { collectAppContent } from "../lib/appcontent/collect";
import { getVerses, searchChunks } from "../lib/knowledge/search";
import { sql } from "./db.mjs";

const QUICK = process.argv.includes("--quick");
const TOP = 12;
const results: { name: string; ok: number; total: number; min: number; misses: string[] }[] = [];

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; await fn(x); } }));
}
async function found(query: string, id: string): Promise<boolean> {
  const { chunks } = await searchChunks(query, { maxChunks: TOP, maxTokens: 60000, perSignal: 30 });
  return chunks.some((c) => c.id === id);
}
async function check(name: string, items: { id: string; query: string }[], min: number) {
  const misses: string[] = [];
  await pool(items, 4, async (x) => { if (!(await found(x.query, x.id).catch(() => false))) misses.push(x.id); });
  results.push({ name, ok: items.length - misses.length, total: items.length, min, misses });
  console.log(`${name}: ${items.length - misses.length}/${items.length} (${Math.round(((items.length - misses.length) / items.length) * 100)}%)`);
}

async function main() {
  // 1) the app's own content: every record, asked by its title (a student names the character, the place, the object...)
  const app = collectAppContent();
  await check("app content (every record, by title)", (QUICK ? app.slice(0, 60) : app).map((r) => ({ id: r.id, query: r.title.replace(/^.*> /, "") })), 0.9);

  // 2) library chunks of every database: a random sample by its own title
  const lib = await sql("select id, title_path from chunks where title_path is not null order by random() limit 60");
  await check("main database chunks (Bible windows, dictionary)", lib.map((r: Record<string, string>) => ({ id: r.id, query: r.title_path.split(">").pop()!.trim() })), 0.7);

  // 3) exact verses: a random sample of (version, reference) must come back with text
  const verses = await sql(`select version_id, ref from bible_verses order by random() limit ${QUICK ? 40 : 150}`);
  let missing = 0;
  await pool(verses as Record<string, string>[], 6, async (v) => { const r = await getVerses(v.version_id, [v.ref]).catch(() => []); if (!r.some((x) => x.ref === v.ref && x.text)) missing++; });
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
