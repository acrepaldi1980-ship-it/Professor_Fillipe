// Loads the timelines into `timelines` (Supabase). Idempotent. Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/seed-timelines.mts
import { TIMELINES } from "../lib/visuals/timeline-data";
import { sql } from "./db.mjs";

const q = (s: string) => s.replace(/'/g, "''");
for (const t of TIMELINES) {
  await sql(`insert into timelines (id, name, events) values ('${t.id}','${q(t.name)}','${q(JSON.stringify(t.events))}'::jsonb) on conflict (id) do update set name=excluded.name, events=excluded.events, updated_at=now()`);
}
console.log(`${TIMELINES.length} timelines loaded`);
