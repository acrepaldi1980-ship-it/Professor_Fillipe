// Seeds prompt_versions with version 1 of the editable layers (the texts of spec 11 as they are in lib/teacher/prompts.ts).
// Idempotent. Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/seed-prompts.ts
import { LAYER_IDENTITY, LAYER_MODE_FREE } from "../lib/teacher/prompts";
import { sql } from "./db.mjs";

const quote = (s: string) => "$pv$" + s + "$pv$";
for (const [layer, content] of [
  ["identity", LAYER_IDENTITY],
  ["mode_free", LAYER_MODE_FREE],
] as const) {
  await sql(`insert into prompt_versions (layer, content, version, active) values ('${layer}', ${quote(content)}, 1, true) on conflict (layer, version) do nothing`);
}
console.log(await sql("select layer, version, active, length(content) len from prompt_versions order by layer, version"));
