// Daily backup of user data (RNF-12) and restore test.
//   node scripts/backup.mjs backup [dir]        -> dir/pf-backup-YYYY-MM-DD.json.gz (all public tables except the rebuildable library: chunks, bible_verses)
//   node scripts/backup.mjs restore-test <file> -> loads the file into a scratch schema, compares row counts, drops the schema
// The library (chunks, embeddings) is rebuilt by scripts/ingest; Supabase also keeps its own platform backups.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { sql as rawSql } from "./db.mjs";

// The Management API throttles bursts: pace the calls and retry on 429.
async function sql(q) {
  for (let i = 0; ; i++) {
    try {
      await new Promise((r) => setTimeout(r, 350));
      return await rawSql(q);
    } catch (e) {
      if (i < 6 && String(e.message).includes("429")) await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
      else throw e;
    }
  }
}

const SKIP = new Set(["chunks", "bible_verses", "schema_migrations", "rate_limits"]);
const lit = (v) => (v === null ? "null" : `'${String(typeof v === "object" ? JSON.stringify(v) : v).replaceAll("'", "''")}'`);

async function tables() {
  return (await sql("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")).map((r) => r.table_name).filter((t) => !SKIP.has(t));
}

async function backup(dir = "backups") {
  mkdirSync(dir, { recursive: true });
  const out = { taken_at: new Date().toISOString(), tables: {} };
  for (const t of await tables()) out.tables[t] = await sql(`select to_jsonb(x) as r from public."${t}" x`).then((rows) => rows.map((r) => r.r));
  const file = `${dir}/pf-backup-${out.taken_at.slice(0, 10)}.json.gz`;
  writeFileSync(file, gzipSync(JSON.stringify(out)));
  const counts = Object.fromEntries(Object.entries(out.tables).map(([t, r]) => [t, r.length]));
  console.log(`backup ${file}: ${Object.values(counts).reduce((a, b) => a + b, 0)} rows in ${Object.keys(counts).length} tables`);
  return { file, counts };
}

async function restoreTest(file) {
  const data = JSON.parse(gunzipSync(readFileSync(file)).toString());
  await sql("drop schema if exists restore_test cascade; create schema restore_test");
  let ok = true;
  try {
    for (const [t, rows] of Object.entries(data.tables)) {
      // same columns and types as the live table, no constraints (a pure data restore check)
      await sql(`create table restore_test."${t}" as select * from public."${t}" with no data`);
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200).map((r) => `(select * from jsonb_populate_record(null::restore_test."${t}", ${lit(r)}::jsonb))`);
        await sql(`insert into restore_test."${t}" ${batch.join(" union all ")}`);
      }
      const [{ n }] = await sql(`select count(*)::int n from restore_test."${t}"`);
      if (n !== rows.length) { ok = false; console.log(`MISMATCH ${t}: file ${rows.length}, restored ${n}`); }
    }
  } finally {
    await sql("drop schema if exists restore_test cascade");
  }
  console.log(ok ? `restore test OK (${Object.keys(data.tables).length} tables restored and compared)` : "restore test FAILED");
  return ok;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "backup") await backup(arg);
else if (cmd === "restore-test") process.exit((await restoreTest(arg)) ? 0 : 1);
else console.log("usage: backup [dir] | restore-test <file>");
