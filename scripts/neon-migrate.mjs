// Applies neon/*.sql to the Neon reference database and creates the read-only role for the app.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/neon-migrate.mjs
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { nsql } from "./neon.mjs";

for (const f of readdirSync("neon").filter((f) => f.endsWith(".sql")).sort()) {
  const statements = readFileSync(`neon/${f}`, "utf8").split(/;\s*\n(?=\s*(?:create|alter|grant|drop|insert|do)\b)/i).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const s of statements) await nsql(s);
  console.log("applied", f);
}
const have = await nsql("select 1 from pg_roles where rolname='app_reader'");
if (!have.length) {
  const pw = randomBytes(24).toString("base64url");
  await nsql(`create role app_reader login password '${pw}'`);
  const u = new URL(process.env.NEON_OWNER_URL);
  u.username = "app_reader";
  u.password = pw;
  appendFileSync(".env.local", `REFERENCE_DATABASE_URL=${u.toString()}\n`);
  console.log("role app_reader created; REFERENCE_DATABASE_URL saved to .env.local");
}
await nsql("grant usage on schema public to app_reader");
await nsql("grant select on all tables in schema public to app_reader");
await nsql("alter default privileges in schema public grant select on tables to app_reader");
console.log("ok");
