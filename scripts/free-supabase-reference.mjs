// After copy-to-neon.mjs reported OK for every table, empties the reference tables in Supabase to free space (hybrid, D-20).
// The data can always be rebuilt from the sources with the ingest scripts. Refuses to run if Neon has fewer rows.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/free-supabase-reference.mjs
import { sql } from "./db.mjs";
import { nsql } from "./neon.mjs";

const TABLES = ["original_words", "lexicon_entries", "cross_refs", "verse_map"];
for (const t of TABLES) {
  const [{ a }] = await sql(`select count(*)::int a from ${t}`);
  const [{ b }] = await nsql(`select count(*)::int b from ${t}`);
  if (b < a) throw new Error(`${t}: Neon has ${b} rows, Supabase ${a}; not clearing`);
  await sql(`truncate table ${t}`);
  console.log(`${t}: ${a} rows moved to Neon, Supabase table cleared`);
}
const [{ s }] = await sql("select pg_size_pretty(pg_database_size(current_database())) s");
console.log("Supabase size now:", s);
