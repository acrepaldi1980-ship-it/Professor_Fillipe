// Copies reference tables from Supabase to Neon (idempotent: ON CONFLICT DO NOTHING). Does NOT delete anything in Supabase.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/copy-to-neon.mjs [table ...]
import { sql } from "./db.mjs";
import { nsql } from "./neon.mjs";

const TABLES = {
  verse_map: { cols: ["tradition", "ref", "eng_ref"], order: "tradition, ref" },
  lexicon_entries: { cols: ["id", "strong", "lemma", "language", "source", "definition"], order: "id" },
  original_words: { cols: ["ref", "position", "surface", "lemma", "strong", "morph", "translit", "gloss", "source"], order: "ref, position, source" },
  cross_refs: { cols: ["from_ref", "to_ref", "votes", "source"], order: "from_ref, to_ref, source" },
};
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sb(q) {
  for (let i = 0; i < 6; i++) {
    try { return await sql(q); } catch (e) { if (!/429|Throttler/.test(e.message)) throw e; await sleep(15000 * (i + 1)); }
  }
  throw new Error("rate limited");
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TABLES);
for (const t of want) {
  const { cols, order } = TABLES[t];
  const [{ n }] = await sb(`select count(*)::int n from ${t}`);
  let done = 0;
  const PAGE = t === "lexicon_entries" ? 1500 : 6000;
  while (done < n) {
    const rows = await sb(`select ${cols.join(",")} from ${t} order by ${order} offset ${done} limit ${PAGE}`);
    if (!rows.length) break;
    for (let i = 0; i < rows.length; i += 1500) {
      const part = rows.slice(i, i + 1500).map((r) => `(${cols.map((c) => lit(r[c])).join(",")})`).join(",");
      await nsql(`insert into ${t} (${cols.join(",")}) values ${part} on conflict do nothing`);
    }
    done += rows.length;
    if ((done / PAGE) % 10 < 1) console.log(t, done, "/", n);
  }
  const [{ c }] = await nsql(`select count(*)::int c from ${t}`);
  console.log(`${t}: supabase=${n} neon=${c} ${n === c ? "OK" : "MISMATCH"}`);
}
