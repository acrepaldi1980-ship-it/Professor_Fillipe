// Runs SQL against the Supabase project through the Management API (HTTPS only).
// The access token is injected by the network proxy; nothing secret lives here.
import { readFileSync, readdirSync } from "node:fs";

const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`;

export async function sql(query) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${body.slice(0, 500)}`);
  return JSON.parse(body);
}

export async function migrate(dir = "supabase/migrations") {
  await sql("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await sql("select name from schema_migrations")).map((r) => r.name));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    console.log("applying", f);
    await sql(readFileSync(`${dir}/${f}`, "utf8"));
    await sql(`insert into schema_migrations(name) values ('${f}')`);
  }
  console.log("migrations up to date");
}

if (process.argv[1] && process.argv[1].endsWith("db.mjs")) {
  const cmd = process.argv[2];
  if (cmd === "migrate") await migrate();
  else if (cmd === "query") console.log(JSON.stringify(await sql(process.argv[3]), null, 2));
  else console.log("usage: node scripts/db.mjs migrate | query '<sql>'");
}
