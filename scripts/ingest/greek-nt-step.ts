// Greek New Testament word by word (STEPBible TAGNT, Tyndale House, CC BY 4.0) + Greek brief lexicon (TBESG, based on
// Abbott-Smith, CC BY 4.0). Hebrew data is NOT loaded here: the Hebrew brief lexicon (TBESH) says permission from
// Online Bible is needed, so it stays out until that is clarified (rule: doubtful license = not imported).
// Usage: NODE_OPTIONS=--use-env-proxy tsx scripts/ingest/greek-nt-step.ts   (needs a clone of STEPBible-Data in $STEP_DIR)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { checkLicense } from "../../lib/knowledge/licenses";
import { sql } from "../db.mjs";

const DIR = process.env.STEP_DIR ?? "/tmp/mh/STEPBible-Data";
const FILES = [
  `${DIR}/Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt`,
  `${DIR}/Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt`,
];
const LEX = `${DIR}/Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt`;
const SRC = "https://github.com/STEPBible/STEPBible-Data";
const CREDIT = "Dados de STEPBible.org, baseados no trabalho do Tyndale House, Cambridge (CC BY 4.0). Fonte: https://STEPBible.github.io/STEPBible-Data/";

const q = (s: string) => s.replace(/'/g, "''");
const lit = (s: string | null | undefined) => (s ? `'${q(s)}'` : "null");

async function work(id: string, title: string, kind: string, file: string) {
  const gate = checkLicense({ license: "cc_by" });
  if (!gate.ok) throw new Error(gate.reason);
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('${id}','${q(title)}',ARRAY['STEPBible.org / Tyndale House']::text[],'{}','{}',2024,'grc','${kind}','general','cc_by','${q(CREDIT)}','${SRC}',now(),'${hash}',true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, file_hash=excluded.file_hash, collected_at=now()`);
}

async function words() {
  const rows: string[] = [];
  let total = 0;
  const flush = async () => {
    if (!rows.length) return;
    await sql(`insert into original_words (ref,position,surface,lemma,strong,morph,translit,gloss,source) values ${rows.join(",")} on conflict do nothing`);
    total += rows.length;
    rows.length = 0;
  };
  for (const f of FILES) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = /^([1-3A-Za-z]{3})\.(\d+)\.(\d+)#(\d+)=(\S+)\t/.exec(line);
      if (!m) continue;
      const [, book, ch, vs, pos, type] = m;
      if (!type.startsWith("N")) continue; // words of the Nestle-Aland text (what most translations follow)
      const c = line.split("\t");
      const greek = c[1] ?? "";
      const surface = greek.replace(/\s*\(.*$/, "").trim();
      const translit = /\(([^)]*)\)/.exec(greek)?.[1] ?? null;
      const [strong, morph] = (c[3] ?? "").split("=");
      const lemma = (c[4] ?? "").split("=")[0] || null;
      const gloss = (c[2] ?? "").trim() || null;
      rows.push(`('${book.toUpperCase()}.${+ch}.${+vs}',${+pos},${lit(surface)},${lit(lemma)},${lit(strong)},${lit(morph)},${lit(translit)},${lit(gloss)},'step_tagnt')`);
      if (rows.length >= 800) await flush();
    }
  }
  await flush();
  console.log("original words stored:", total);
}

async function lexicon() {
  const rows: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  const flush = async () => {
    if (!rows.length) return;
    await sql(`insert into lexicon_entries (id,strong,lemma,language,source,definition) values ${rows.join(",")} on conflict (id) do update set definition=excluded.definition, lemma=excluded.lemma, updated_at=now()`);
    total += rows.length;
    rows.length = 0;
  };
  for (const line of readFileSync(LEX, "utf8").split("\n")) {
    const c = line.split("\t");
    if (!/^G\d{4}/.test(c[0] ?? "") || c.length < 8) continue;
    const id = (c[2] ?? c[0]).replace(/\s+/g, "");
    if (seen.has(id)) continue;
    seen.add(id);
    const def = (c[7] ?? "").replace(/<BR\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const gloss = (c[6] ?? "").trim();
    if (!def && !gloss) continue;
    rows.push(`('tbesg:${id}',${lit(c[0].trim().slice(0, 5))},${lit(c[3]?.trim())},'grc','step_tbesg',${lit((gloss ? gloss + ". " : "") + def.slice(0, 1400))})`);
    if (rows.length >= 300) await flush();
  }
  await flush();
  console.log("lexicon entries stored:", total);
}

async function main() {
  await work("step_tagnt", "Novo Testamento grego palavra por palavra (TAGNT)", "bible_text", FILES[0]);
  await work("step_tbesg", "Léxico breve do grego (TBESG, base Abbott-Smith)", "lexicon", LEX);
  if (!process.argv.includes("--lexicon-only")) await words();
  await lexicon();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
