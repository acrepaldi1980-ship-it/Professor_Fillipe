// Audit of the search index. A work is searchable when it has chunks in the main database or in any library shard, verses in bible_verses (Bible versions)
// or rows in the lexicon tables. This script cross-checks the catalogue of works against all of them and reports what is NOT reachable, plus broken rows.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/audit-index.mjs
import { sql } from "./db.mjs";

function neon(url) {
  const host = new URL(url).host;
  return async (text, params = []) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`https://${host}/sql`, { method: "POST", headers: { "Content-Type": "application/json", "Neon-Connection-String": url }, body: JSON.stringify({ query: text, params }) });
      const body = await res.text();
      if (res.ok) { const j = JSON.parse(body); return (j.rows ?? []).map((r) => (Array.isArray(r) ? Object.fromEntries(j.fields.map((f, i) => [f.name, r[i]])) : r)); }
      if (res.status >= 500 || res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      throw new Error(`Neon SQL failed (${res.status}): ${body.slice(0, 300)}`);
    }
    throw new Error("Neon SQL failed");
  };
}
const shards = [process.env.NEON_OWNER_URL, process.env.NEON_OWNER_URL_2].filter(Boolean).map(neon);
const out = [];
const say = (...a) => { console.log(...a); out.push(a.join(" ")); };

// 1) every chunk store
const where = new Map(); // work_id -> { chunks, places }
const add = (id, n, place) => { const w = where.get(id) ?? { chunks: 0, places: [] }; w.chunks += Number(n); w.places.push(place); where.set(id, w); };
let broken = 0;
const [main] = await sql("select count(*) as n, count(*) filter (where embedding is null) as e, count(*) filter (where tsv is null) as t from chunks");
say(`Supabase chunks: ${main.n} (without embedding ${main.e}, without text vector ${main.t})`); broken += Number(main.e) + Number(main.t);
for (const r of await sql("select work_id, count(*) as n from chunks group by 1")) add(r.work_id, r.n, "supabase");
for (const [i, q] of shards.entries()) {
  const [t] = await q("select count(*) as n, count(*) filter (where embedding is null) as e, count(*) filter (where tsv is null) as t from chunks");
  say(`Neon shard ${i + 1} chunks: ${t.n} (without embedding ${t.e}, without text vector ${t.t})`); broken += Number(t.e) + Number(t.t);
  for (const r of await q("select work_id, count(*) as n from chunks group by 1")) add(r.work_id, r.n, `neon${i + 1}`);
  const hidden = await q("select c.work_id, count(*) as n from chunks c left join library_works w on w.id = c.work_id where w.id is null or not w.enabled group by 1");
  if (hidden.length) { say(`  !! shard ${i + 1}: chunks of works missing/disabled in library_works (invisible): ${hidden.map((h) => `${h.work_id}:${h.n}`).join(", ")}`); broken += hidden.length; }
}

// 2) the catalogue
const works = await sql("select id, title, kind, enabled, review_status from works order by id");
const verses = new Set((await sql("select distinct version_id from bible_verses")).map((r) => r.version_id));
const lexicon = (await shards[0]("select count(*) as n from lexicon_entries"))[0].n;
const original = (await shards[0]("select count(*) as n from original_words"))[0].n;
say(`Catalogue: ${works.length} works (${works.filter((w) => w.enabled).length} enabled); Bible versions with verses: ${verses.size}; lexicon entries ${lexicon}; original-language words ${original}`);
const missing = [], ok = [], viaVerses = [], viaTables = [];
for (const w of works.filter((x) => x.enabled)) {
  if (where.has(w.id)) { ok.push(w); continue; }
  const version = w.id.replace(/^bible_/, "");
  if (w.kind === "bible_text" && verses.has(version)) { viaVerses.push(w); continue; }
  if (/^step_|^theographic|^tsk_|^openbible|^pleiades/.test(w.id)) { viaTables.push(w); continue; }
  missing.push(w);
}
say(`Enabled works: ${ok.length} reachable through chunks, ${viaVerses.length} through verses, ${viaTables.length} through lexicon/graph/cross-reference tables, ${missing.length} NOT REACHABLE`);
for (const w of missing) say(`  !! not reachable: ${w.id}  ${String(w.title).slice(0, 80)}  (${w.kind}, ${w.review_status})`);
const stray = [...where.keys()].filter((id) => !works.some((w) => w.id === id));
if (stray.length) say(`  chunks whose work is not in the catalogue (no credit/licence record): ${stray.length} (${stray.slice(0, 12).join(", ")}${stray.length > 12 ? ", ..." : ""})`);
const disabledButIndexed = works.filter((w) => !w.enabled && where.has(w.id));
if (disabledButIndexed.length) say(`  disabled works that still have chunks (fine, hidden by the search): ${disabledButIndexed.length}`);
say(`\nBroken rows or invisible chunks: ${broken}`);
process.exitCode = missing.length || broken ? 1 : 0;
