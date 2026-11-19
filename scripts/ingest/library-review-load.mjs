// Loads data/raw/gutenberg/review-queue.tsv (written by library-gutenberg.ts) into the Neon table library_review.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/ingest/library-review-load.mjs
import { readFileSync } from "node:fs";
import { nsql } from "../neon.mjs";

const lines = readFileSync("data/raw/gutenberg/review-queue.tsv", "utf8").split("\n").filter(Boolean);
const rows = lines.map((l) => { const [id, title, authors, reason] = l.split("\t"); return { id: `pg_${id}`, title, authors, reason }; });
for (let i = 0; i < rows.length; i += 300) {
  await nsql(
    "insert into library_review (id,title,authors,reason) select id,title,authors,reason from jsonb_to_recordset($1::jsonb) as t(id text,title text,authors text,reason text) on conflict (id) do update set reason=excluded.reason",
    [JSON.stringify(rows.slice(i, i + 300))],
  );
}
console.log("review queue:", rows.length);
