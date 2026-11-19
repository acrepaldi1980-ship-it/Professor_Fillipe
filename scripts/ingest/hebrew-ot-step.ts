// Hebrew Old Testament word by word (STEPBible TAHOT, Tyndale House, CC BY 4.0) -> Neon `original_words`.
// Only Leningrad-text words (type L) are stored; references use the English numbering (the Hebrew number is in parentheses in the source).
// The Hebrew brief lexicon (TBESH) is NOT loaded: its header asks for permission from Online Bible (doubtful license).
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/hebrew-ot-step.ts
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { checkLicense } from "../../lib/knowledge/licenses";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const DIR = `${process.env.STEP_DIR ?? "/tmp/mh/STEPBible-Data"}/Translators Amalgamated OT+NT`;
const FILES = readdirSync(DIR).filter((f) => f.startsWith("TAHOT")).sort().map((f) => `${DIR}/${f}`);
const CREDIT = "Dados de STEPBible.org, baseados no trabalho do Tyndale House, Cambridge (CC BY 4.0). Fonte: https://STEPBible.github.io/STEPBible-Data/";
const q = (s: string) => s.replace(/'/g, "''");
const lit = (s: string | null | undefined) => (s ? `'${q(s)}'` : "null");

async function main() {
  const gate = checkLicense({ license: "cc_by" });
  if (!gate.ok) throw new Error(gate.reason);
  const hash = createHash("sha256").update(readFileSync(FILES[0])).digest("hex");
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('step_tahot','Antigo Testamento hebraico palavra por palavra (TAHOT)',ARRAY['STEPBible.org / Tyndale House']::text[],'{}','{}',2024,'hbo','bible_text','general','cc_by','${q(CREDIT)}','https://github.com/STEPBible/STEPBible-Data',now(),'${hash}',true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, file_hash=excluded.file_hash, collected_at=now()`);

  let total = 0;
  const rows: string[] = [];
  const flush = async () => {
    if (!rows.length) return;
    await nsql(`insert into original_words (ref,position,surface,lemma,strong,morph,translit,gloss,source) values ${rows.join(",")} on conflict do nothing`);
    total += rows.length;
    rows.length = 0;
  };
  for (const f of FILES) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = /^([1-3A-Za-z]{3})\.(\d+)\.(\d+)(?:\(\d+\.\d+\))?#(\d+)=(\S+)\t/.exec(line);
      if (!m || m[5] !== "L") continue;
      const c = line.split("\t");
      const strong = /\{([^}]+)\}/.exec(c[4] ?? "")?.[1] ?? null;
      const lemma = strong ? new RegExp(`\\{${strong}=([^=}]+)=`).exec(c[11] ?? "")?.[1] ?? null : null;
      rows.push(`('${m[1].toUpperCase()}.${+m[2]}.${+m[3]}',${+m[4]},${lit(c[1])},${lit(lemma)},${lit(strong)},${lit(c[5])},${lit(c[2])},${lit(c[3])},'step_tahot')`);
      if (rows.length >= 1200) await flush();
    }
  }
  await flush();
  console.log("Hebrew words stored:", total);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
