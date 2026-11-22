// Library ingestion from the Christian Classics Ethereal Library (public-domain plain texts): downloads one text per work (one polite request, CCEL asks for a
// 10 s delay), splits it into entries and chunks, extracts Bible references, embeds and stores. Same license gate (8.10.9), `works` record and storage as the
// other ingestions; NEON_SHARD=2 stores in the second library database. Idempotent per work.
//
// Usage: NEON_SHARD=2 NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/library-ccel.ts --works smith,nave [--dry] [--max-chunks N]
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { approxTokens, splitEntry } from "../../lib/knowledge/chunking";
import { colonCites, groupShort, parseCcel, parseJfb } from "../../lib/knowledge/ccel-text";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { checkLicense } from "../../lib/knowledge/licenses";
import { modernizeCitations } from "../../lib/knowledge/old-citations";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

interface Work { id: string; path: string; title: string; authors: string[]; deaths: number[]; pubYear: number; kind: string; tradition: string; dict: boolean }
const W = (id: string, path: string, title: string, authors: string[], deaths: number[], pubYear: number, kind: string, tradition: string, dict = false): Work => ({ id: `ccel_${id}`, path, title, authors, deaths, pubYear, kind, tradition, dict });
export const WORKS: Record<string, Work> = {
  smith: W("smith", "s/smith_w/bibledict", "Smith's Bible Dictionary (1884)", ["William Smith"], [1893], 1884, "dictionary", "general", true),
  nave: W("nave", "n/nave/bible", "Nave's Topical Bible", ["Orville J. Nave"], [1917], 1896, "dictionary", "general", true),
  torrey: W("torrey", "t/torrey/ttt", "Torrey's New Topical Textbook", ["R. A. Torrey"], [1928], 1897, "dictionary", "general", true),
  mhc1: W("mhc1", "h/henry/mhc1", "Matthew Henry, Commentary on the Whole Bible, vol. 1 (Genesis-Deuteronomy)", ["Matthew Henry"], [1714], 1706, "commentary", "reformed"),
  mhc2: W("mhc2", "h/henry/mhc2", "Matthew Henry, Commentary on the Whole Bible, vol. 2 (Joshua-Esther)", ["Matthew Henry"], [1714], 1708, "commentary", "reformed"),
  mhc3: W("mhc3", "h/henry/mhc3", "Matthew Henry, Commentary on the Whole Bible, vol. 3 (Job-Song of Solomon)", ["Matthew Henry"], [1714], 1710, "commentary", "reformed"),
  mhc4: W("mhc4", "h/henry/mhc4", "Matthew Henry, Commentary on the Whole Bible, vol. 4 (Isaiah-Malachi)", ["Matthew Henry"], [1714], 1712, "commentary", "reformed"),
  mhc5: W("mhc5", "h/henry/mhc5", "Matthew Henry, Commentary on the Whole Bible, vol. 5 (Matthew-John)", ["Matthew Henry", "Joseph Tong"], [1714, 1726], 1721, "commentary", "reformed"),
  mhc6: W("mhc6", "h/henry/mhc6", "Matthew Henry, Commentary on the Whole Bible, vol. 6 (Acts-Revelation)", ["Matthew Henry", "Joseph Tong"], [1714, 1726], 1721, "commentary", "reformed"),
  jfb: W("jfb", "j/jamieson/jfb", "Jamieson, Fausset and Brown, Commentary Critical and Explanatory on the Whole Bible", ["Robert Jamieson", "A. R. Fausset", "David Brown"], [1880, 1910, 1897], 1871, "commentary", "general"),
  wesley: W("wesley", "w/wesley/notes", "John Wesley, Explanatory Notes upon the Old and New Testaments", ["John Wesley"], [1791], 1754, "commentary", "wesleyan"),
  edersheim1: W("edersheim1", "e/edersheim/lifetimes", "Alfred Edersheim, The Life and Times of Jesus the Messiah", ["Alfred Edersheim"], [1889], 1883, "history", "general"),
  edersheim2: W("edersheim2", "e/edersheim/temple", "Alfred Edersheim, The Temple: Its Ministry and Services", ["Alfred Edersheim"], [1889], 1874, "history", "general"),
  edersheim3: W("edersheim3", "e/edersheim/sketches", "Alfred Edersheim, Sketches of Jewish Social Life", ["Alfred Edersheim"], [1889], 1876, "history", "jewish"),
};

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const MAX_CHUNKS = Number(arg("--max-chunks") ?? 30000);
const DIR = "data/raw/ccel";
const UA = "ProfessorFilipeLibrary/1.0 (educational Bible-study app; polite reader, one request per work)";
const q = (s: string) => s.replace(/'/g, "''");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(w: Work): Promise<string> {
  mkdirSync(DIR, { recursive: true });
  const f = `${DIR}/${w.path.split("/").pop()}.txt`;
  if (existsSync(f)) return readFileSync(f, "utf8");
  const url = `https://ccel.org/ccel/${w.path}/cache/${w.path.split("/").pop()}.txt`;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) { const t = await res.text(); if (!t.startsWith("<!DOCTYPE")) { writeFileSync(f, t); await sleep(10000); return t; } }
    await sleep(30000 * (i + 1));
  }
  throw new Error(`download failed: ${url}`);
}

async function main() {
  const ids = (arg("--works") ?? "smith").split(",");
  const emb = getEmbeddingProvider();
  for (const key of ids) {
    const w = WORKS[key];
    if (!w) { console.log(`unknown work ${key}`); continue; }
    const gate = checkLicense({ license: "public_domain", pub_year: w.pubYear, author_death_years: w.deaths }, 2026);
    if (!gate.ok) { console.log(`${w.id}: license gate says no (${gate.reason}); not ingested`); continue; }
    const raw = await download(w);
    let entries = key === "jfb" ? parseJfb(raw) : parseCcel(raw);
    if (w.dict) entries = groupShort(entries);
    const chunks: { id: string; title: string; text: string; refs: string[] }[] = [];
    entries.forEach((e, i) => {
      for (const [k, block] of splitEntry(`${w.title} > ${e.heading.slice(0, 90)}`, e.body).entries()) {
        const refs = [...new Set(findReferences(modernizeCitations(colonCites(block)), { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs))].slice(0, 40);
        chunks.push({ id: `${w.id}:${i}.${k}`, title: `${w.title} > ${e.heading.slice(0, 90)}`, text: block, refs });
      }
    });
    console.log(`${w.id}: ${entries.length} entries -> ${chunks.length} chunks, ${chunks.reduce((t, c) => t + c.refs.length, 0)} references`);
    if (DRY) { for (const c of chunks.slice(0, 3)) console.log("   ", c.title, "|", c.text.slice(c.title.length, c.title.length + 110).replace(/\n/g, " ")); continue; }
    if (chunks.length > MAX_CHUNKS) chunks.length = MAX_CHUNKS;
    const credit = `Texto de domínio público (autores falecidos até ${Math.max(...w.deaths)}). Fonte: Christian Classics Ethereal Library, https://ccel.org/ccel/${w.path}.`;
    await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
      values ('${w.id}','${q(w.title.slice(0, 200))}',ARRAY[${w.authors.map((a) => `'${q(a)}'`).join(",")}]::text[],'{}',ARRAY[${w.deaths.join(",")}]::int[],${w.pubYear},'en','${w.kind}','${w.tradition}','public_domain','${q(credit)}','https://ccel.org/ccel/${w.path}',now(),'${createHash("sha256").update(raw).digest("hex")}',true,'approved')
      on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now(), enabled=true`);
    await nsql("insert into library_works (id, enabled) values ($1, true) on conflict (id) do nothing", [w.id]);
    await nsql("delete from chunks where work_id = $1", [w.id]);
    for (let i = 0; i < chunks.length; i += 24) {
      const part = chunks.slice(i, i + 24);
      const vecs = await emb.embedPassages(part.map((c) => c.text));
      const payload = part.map((c, k) => ({ id: c.id, work_id: w.id, text: c.text, language: "en", title_path: c.title, refs: `{${c.refs.map((r) => `"${r}"`).join(",")}}`, tradition: w.tradition, kind: w.kind, license: "public_domain", tokens: approxTokens(c.text), embedding: `[${vecs[k].map((x) => x.toFixed(5)).join(",")}]` }));
      await nsql(
        `insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
         select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
         from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
         on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`,
        [JSON.stringify(payload)],
      );
      if ((i / 24) % 20 === 0) console.log(`  ${w.id}: ${i + part.length}/${chunks.length}`);
    }
    appendFileSync("data/raw/gutenberg/ingested.tsv", `${w.id}\t${w.kind}\t${w.tradition}\t${chunks.length}\t${w.title.slice(0, 80)}\n`);
    const [{ s }] = await nsql("select pg_size_pretty(pg_database_size(current_database())) s");
    console.log(`  stored ${chunks.length} chunks for ${w.id}; database size ${s}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
