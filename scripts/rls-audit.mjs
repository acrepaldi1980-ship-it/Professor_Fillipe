// RLS audit (Prompt 1.13): every table of the public schema must have RLS enabled; lists tables without policies, and the functions that
// anonymous visitors can execute. Exit code 1 when a table has RLS off. Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/rls-audit.mjs
import { sql } from "./db.mjs";

const tables = await sql(`select c.relname as t, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)::int as policies,
  has_table_privilege('anon', c.oid, 'select') as anon_select, has_table_privilege('anon', c.oid, 'insert,update,delete') as anon_write
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`);
const noRls = tables.filter((x) => !x.rls);
const noPolicy = tables.filter((x) => x.rls && x.policies === 0);
const anonWrite = tables.filter((x) => x.anon_write);
const fns = await sql(`select p.proname as f, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer, has_function_privilege('anon', p.oid, 'execute') as anon_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like any (array['api\\_%','audit%','billing\\_%']) order by 1`);
console.log(`tables: ${tables.length}; without RLS: ${noRls.length}; RLS with no policy (server-only): ${noPolicy.length}; anon can write: ${anonWrite.length}`);
for (const x of noRls) console.log("  NO RLS:", x.t);
console.log("  server-only (RLS, no policy):", noPolicy.map((x) => x.t).join(", ") || "none");
console.log("  anon can write:", anonWrite.map((x) => x.t).join(", ") || "none");
const anonFns = fns.filter((f) => f.anon_exec);
console.log(`functions: ${fns.length}; executable by anon: ${anonFns.length}`);
console.log("  anon-callable:", anonFns.map((f) => f.f).join(", "));
console.log("  not SECURITY DEFINER:", fns.filter((f) => !f.definer).map((f) => f.f).join(", ") || "none");
process.exit(noRls.length ? 1 : 0);
