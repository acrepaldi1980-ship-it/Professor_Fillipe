// Idempotent Bible ingestion from eBible.org USFM zips. Usage: tsx scripts/ingest/bible-ebible.ts [translationId ...]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { BIBLES, copyrightUrl, sourceUrl, type BibleSource } from "./bible-catalog";
import { BOOK_BY_CODE } from "../../lib/knowledge/books";
import { checkLicense } from "../../lib/knowledge/licenses";
import { parseUsfm } from "../../lib/knowledge/usfm";
import { sql } from "../db.mjs";

const RAW = "data/raw";
const BATCH = 1500;

async function download(src: BibleSource): Promise<Uint8Array> {
  mkdirSync(RAW, { recursive: true });
  const path = `${RAW}/${src.translationId}_usfm.zip`;
  if (!existsSync(path)) {
    const res = await fetch(sourceUrl(src.translationId));
    if (!res.ok) throw new Error(`download ${src.translationId}: ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

async function ingest(src: BibleSource) {
  const gate = checkLicense({ license: src.license, pub_year: src.pubYear, author_death_years: src.deathYears });
  if (!gate.ok) {
    console.log(`SKIP ${src.versionId}: ${gate.reason}`);
    return;
  }
  const zip = await download(src);
  const hash = createHash("sha256").update(zip).digest("hex");
  const files = unzipSync(zip);
  const verses: { version_id: string; ref: string; book_code: string; chapter: number; verse: number; text: string }[] = [];
  const dropped = new Set<string>();
  for (const [name, data] of Object.entries(files)) {
    if (!/\.(usfm|sfm)$/i.test(name)) continue;
    for (const v of parseUsfm(strFromU8(data))) {
      if (!BOOK_BY_CODE[v.book]) {
        dropped.add(v.book);
        continue;
      }
      verses.push({ version_id: src.versionId, ref: `${v.book}.${v.chapter}.${v.verse}`, book_code: v.book, chapter: v.chapter, verse: v.verse, text: v.text });
    }
  }
  // de-duplicate (same ref twice would break the upsert)
  const uniq = [...new Map(verses.map((v) => [v.ref, v])).values()];

  const workId = `bible_${src.versionId}`;
  const q = (s: string) => s.replace(/'/g, "''");
  const arr = (a: string[]) => `ARRAY[${a.map((x) => `'${q(x)}'`).join(",")}]::text[]`;
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('${workId}','${q(src.name)}',${arr(src.authors)},'{}',ARRAY[${src.deathYears.join(",")}]::int[],${src.pubYear ?? "null"},'${src.language}','bible_text','general','${src.license}','${q(src.credit)}','${copyrightUrl(src.translationId)}',now(),'${hash}',false,'pending')
    on conflict (id) do update set title=excluded.title, license=excluded.license, credit_text=excluded.credit_text, source_url=excluded.source_url, file_hash=excluded.file_hash, collected_at=now()`);
  await sql(`insert into bible_versions (id,work_id,name,abbreviation,language,audience) values ('${src.versionId}','${workId}','${q(src.name)}','${q(src.abbreviation)}','${src.language}','${src.audience ?? "general"}')
    on conflict (id) do update set name=excluded.name, abbreviation=excluded.abbreviation, audience=excluded.audience`);
  for (let i = 0; i < uniq.length; i += BATCH) {
    const json = JSON.stringify(uniq.slice(i, i + BATCH));
    await sql(`insert into bible_verses (version_id,ref,book_code,chapter,verse,text)
      select version_id,ref,book_code,chapter,verse,text from jsonb_to_recordset($j$${json}$j$::jsonb) as t(version_id text,ref text,book_code text,chapter int,verse int,text text)
      on conflict (version_id,ref) do update set text=excluded.text`);
  }
  const [{ n }] = await sql(`select count(*)::int n from bible_verses where version_id='${src.versionId}'`);
  const ok = n > 1000;
  await sql(`update works set enabled=${ok}, review_status='${ok ? "approved" : "pending"}' where id='${workId}'`);
  console.log(`${ok ? "OK  " : "WARN"} ${src.versionId}: ${n} verses${dropped.size ? ` (dropped non-canonical books: ${[...dropped].join(",")})` : ""}`);

  const lic = readFileSync("docs/LICENSES.md", "utf8");
  if (!lic.includes(`## ${workId} `)) {
    appendFileSync("docs/LICENSES.md", `\n## ${workId} — ${src.name}\n- Autor(es) / tradutor(es) e anos de morte: ${src.authors.length ? src.authors.join(", ") + " (" + src.deathYears.join(", ") + ")" : "sem autor individual identificado"}\n- Edição e ano de publicação: ${src.pubYear ?? "não informado"}\n- Licença: ${src.license} (${gate.reason}). Verificada na página de direitos do eBible.org.\n- Crédito exigido (texto exato): ${src.credit}\n- Fonte (URL): ${sourceUrl(src.translationId)} (direitos: ${copyrightUrl(src.translationId)})\n- Data da coleta: ${new Date().toISOString().slice(0, 10)}\n- Hash SHA-256 do arquivo: ${hash}\n- Observações: ${src.notes ?? "—"}\n`);
  }
}

async function main() {
  const want = process.argv.slice(2);
  for (const src of BIBLES.filter((b) => !want.length || want.includes(b.translationId))) {
    try {
      await ingest(src);
    } catch (e) {
      console.log(`FAIL ${src.versionId}: ${(e as Error).message}`);
    }
  }
}
main();
