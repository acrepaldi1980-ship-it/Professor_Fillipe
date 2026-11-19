// Cross-references of the Treasury of Scripture Knowledge (public domain), in the CrossReferences.org dataset
// (CC BY 4.0), KJV file. One row per (verse, target) in cross_refs; targets keep ranges ("PRO.8.22-PRO.8.24").
// Usage: NODE_OPTIONS=--use-env-proxy tsx scripts/ingest/crossrefs-tsk.ts   (needs a clone of the dataset in $XREF_DIR)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { checkLicense } from "../../lib/knowledge/licenses";
import { parseReference } from "../../lib/knowledge/refs-parser";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const FILE = `${process.env.XREF_DIR ?? "/tmp/mh/bible-cross-references"}/tsv/crossreferences_kjv.tsv`;
const CREDIT =
  "Referências cruzadas do Treasury of Scripture Knowledge (domínio público), no conjunto de dados CrossReferences.org (CC BY 4.0): https://github.com/CrossReferences-org/bible-cross-references";
const q = (s: string) => s.replace(/'/g, "''");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function safeSql(query: string) {
  for (let i = 0; i < 6; i++) {
    try {
      return await sql(query);
    } catch (e) {
      if (!/429|Throttler/.test((e as Error).message)) throw e;
      await sleep(15000 * (i + 1));
    }
  }
  throw new Error("rate limited");
}

async function main() {
  const gate = checkLicense({ license: "cc_by" });
  if (!gate.ok) throw new Error(gate.reason);
  const text = readFileSync(FILE, "utf8");
  await safeSql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('tsk_crossrefs','Referências cruzadas (Treasury of Scripture Knowledge)',ARRAY['R. A. Torrey (ed.)']::text[],'{}',ARRAY[1928]::int[],1880,'en','study_notes','general','cc_by','${q(CREDIT)}','https://github.com/CrossReferences-org/bible-cross-references',now(),'${createHash("sha256").update(text).digest("hex")}',true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now()`);

  const pairs = new Set<string>();
  for (const line of text.split("\n").slice(1)) {
    const [book, ch, vs, , refs] = line.split("\t");
    if (!book || !refs) continue;
    const from = parseReference(`${book} ${ch}:${vs}`)?.[0];
    if (!from) continue;
    for (const item of refs.split("|")) {
      const m = /^(.+?) (\d+):(.+)$/.exec(item.trim());
      const list = m ? m[3].split(",").map((p) => `${m[1]} ${m[2]}:${p.trim()}`) : [item.trim()];
      for (const s of list) {
        const to = parseReference(s)?.[0];
        if (to && to !== from) pairs.add(`${from}|${to}`);
      }
    }
  }
  const all = [...pairs];
  console.log("pairs:", all.length);
  for (let i = 0; i < all.length; i += 3000) {
    const rows = all.slice(i, i + 3000).map((p) => { const [a, b] = p.split("|"); return `('${a}','${b}',0,'tsk')`; }).join(",");
    await nsql(`insert into cross_refs (from_ref,to_ref,votes,source) values ${rows} on conflict do nothing`);
    if ((i / 3000) % 20 === 0) console.log("stored", Math.min(i + 3000, all.length));
  }
  console.log("done");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
