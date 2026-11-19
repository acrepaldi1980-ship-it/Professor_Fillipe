// Full Greek lexicon (STEPBible TFLSJ: LSJ formatted by Tyndale House, CC BY 4.0) -> Neon `lexicon_entries` (source step_tflsj).
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/lsj-step.ts
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { checkLicense } from "../../lib/knowledge/licenses";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const DIR = `${process.env.STEP_DIR ?? "/tmp/mh/STEPBible-Data"}/Lexicons`;
const FILES = readdirSync(DIR).filter((f) => f.startsWith("TFLSJ")).sort().map((f) => `${DIR}/${f}`);
const CREDIT = "Dados de STEPBible.org, baseados no trabalho do Tyndale House, Cambridge (CC BY 4.0), a partir do léxico Liddell-Scott-Jones. Fonte: https://STEPBible.github.io/STEPBible-Data/";
const q = (s: string) => s.replace(/'/g, "''");
const lit = (s: string | null | undefined) => (s ? `'${q(s)}'` : "null");

function clean(html: string): string {
  return html
    .replace(/<a [^>]*>([^<]*)<\/a>/gi, "$1") // keep the visible text, drop the hover tooltips
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const gate = checkLicense({ license: "cc_by" });
  if (!gate.ok) throw new Error(gate.reason);
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('step_tflsj','Léxico grego completo (LSJ formatado, TFLSJ)',ARRAY['Liddell, Scott, Jones; STEPBible.org / Tyndale House']::text[],'{}',ARRAY[1898,1887,1953]::int[],1940,'grc','lexicon','general','cc_by','${q(CREDIT)}','https://github.com/STEPBible/STEPBible-Data',now(),'${createHash("sha256").update(readFileSync(FILES[0])).digest("hex")}',true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now()`);
  const seen = new Set<string>();
  const rows: string[] = [];
  let total = 0;
  const flush = async () => {
    if (!rows.length) return;
    await nsql(`insert into lexicon_entries (id,strong,lemma,language,source,definition) values ${rows.join(",")} on conflict (id) do update set definition=excluded.definition, updated_at=now()`);
    total += rows.length;
    rows.length = 0;
  };
  for (const f of FILES) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const c = line.split("\t");
      if (!/^G\d{4,5}/.test(c[0] ?? "") || c.length < 8) continue;
      const id = `tflsj:${(c[2] ?? c[0]).replace(/\s+/g, "")}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const def = clean(c[7] ?? "").slice(0, 6000);
      if (!def) continue;
      rows.push(`('${id}',${lit(c[0].trim().slice(0, 5))},${lit(c[3]?.trim())},'grc','step_tflsj',${lit(`${(c[6] ?? "").trim()}. ${def}`)})`);
      if (rows.length >= 150) await flush();
    }
  }
  await flush();
  console.log("LSJ entries stored:", total);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
