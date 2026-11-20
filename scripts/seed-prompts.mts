// Seeds prompt_versions with the current version (1 was the spec 11 text) of the editable layers (the texts of spec 11 as they are in lib/teacher/prompts.ts).
// Idempotent. Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/seed-prompts.ts
import { LAYER_IDENTITY, LAYER_MODE_FREE, PROMPT_DB_VERSION } from "../lib/teacher/prompts";
import { sql } from "./db.mjs";

const quote = (s: string) => "$pv$" + s + "$pv$";
for (const [layer, content] of [
  ["identity", LAYER_IDENTITY],
  ["mode_free", LAYER_MODE_FREE],
] as const) {
  // Makes PROMPT_DB_VERSION the active version of the layer (older versions stay for rollback).
  await sql(`update prompt_versions set active = false where layer = '${layer}' and version <> ${PROMPT_DB_VERSION}`);
  await sql(`insert into prompt_versions (layer, content, version, active) values ('${layer}', ${quote(content)}, ${PROMPT_DB_VERSION}, true) on conflict (layer, version) do update set content = excluded.content, active = true`);
}
console.log(await sql("select layer, version, active, length(content) len from prompt_versions order by layer, version"));
