// Loads the verse-number differences between traditions (STEPBible TVTMS, CC BY 4.0) into verse_map.
// Usage: NODE_OPTIONS=--use-env-proxy tsx scripts/ingest/versification-step.ts   (needs STEPBible-Data in $STEP_DIR)
import { readFileSync, readdirSync } from "node:fs";
import { parseTvtmsCondensed } from "../../lib/knowledge/versification";
import { nsql } from "../neon.mjs";

async function main() {
  const DIR = `${process.env.STEP_DIR ?? "/tmp/mh/STEPBible-Data"}/Versification`;
  const file = readdirSync(DIR).find((f) => f.startsWith("TVTMS"))!;
  const lines = readFileSync(`${DIR}/${file}`, "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("#DataStart(Condensed)"));
  const end = 4146; // the condensed section ends where the expanded table starts
  const rows = parseTvtmsCondensed(lines.slice(start, end));
  console.log("differing verses:", rows.length);
  for (let i = 0; i < rows.length; i += 800) {
    const part = rows.slice(i, i + 800).map((r) => `('${r.tradition}','${r.ref}','${r.engRef}')`).join(",");
    await nsql(`insert into verse_map (tradition,ref,eng_ref) values ${part} on conflict do nothing`);
  }
  console.log("stored");

}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
