// Josephus (Prompt M20): reads the four works from Project Gutenberg (Whiston's translation, public domain), parses books, chapters and numbered sections,
// stores them for reading (josephus_sections, josephus_chapters) and as search chunks (works jos_ant, jos_war, jos_life, jos_apion) with Bible parallels,
// replacing the earlier truncated ingestion of the same books. Idempotent.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/josephus.ts [--dry]
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { approxTokens } from "../../lib/knowledge/chunking";
import { stripGutenberg } from "../../lib/knowledge/book-text";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { checkLicense } from "../../lib/knowledge/licenses";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { PARALLELS } from "../../lib/josephus/books";
import { cite, parseWork, WORKS, type WorkKey, type Section } from "../../lib/josephus/structure";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const DRY = process.argv.includes("--dry");
const MIRROR = process.env.GUTENBERG_MIRROR ?? "https://gutenberg.pglaf.org";
const DIR = "data/raw/gutenberg";
const q = (s: string) => s.replace(/'/g, "''");
const EN: Record<WorkKey, string> = { ant: "Antiquities of the Jews", war: "The Jewish War (Wars of the Jews)", life: "The Life of Flavius Josephus", apion: "Against Apion" };
const WORK_IDS: Record<WorkKey, string> = { ant: "jos_ant", war: "jos_war", life: "jos_life", apion: "jos_apion" };

async function text(id: string): Promise<string> {
  mkdirSync(DIR, { recursive: true });
  const path = `${DIR}/${id}.txt`;
  if (existsSync(path)) return readFileSync(path, "utf8");
  const res = await fetch(`${MIRROR}/cache/epub/${id}/pg${id}.txt`);
  if (!res.ok) throw new Error(`download ${id}: ${res.status}`);
  const t = await res.text(); writeFileSync(path, t); return t;
}

/** Consecutive sections of one chapter grouped into blocks of about 600 tokens, each keeping the citation of its first and last section. */
function blocks(work: WorkKey, secs: Section[]) {
  const out: { id: string; label: string; text: string; refs: string[] }[] = [];
  let acc: Section[] = [], tok = 0;
  const flush = () => {
    if (!acc.length) return;
    const a = acc[0], b = acc[acc.length - 1];
    const label = a.n === b.n ? cite(work, a.book, a.chapter, a.n) : `${cite(work, a.book, a.chapter, a.n)}-${b.n}`;
    const body = acc.map((s) => `[${s.n}] ${s.text}`).join(" ");
    const parallel = PARALLELS.filter((p) => p.work === work && p.book === a.book && p.chapter === a.chapter && acc.some((s) => s.n === p.n)).flatMap((p) => p.refs);
    const refs = [...new Set([...parallel, ...findReferences(body, { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs)])].slice(0, 40);
    out.push({ id: `${WORK_IDS[work]}:${a.book}.${a.chapter}.${a.n}`, label, text: body, refs });
    acc = []; tok = 0;
  };
  for (const s of secs) {
    const t = approxTokens(s.text);
    if (acc.length && tok + t > 700) flush();
    acc.push(s); tok += t;
  }
  flush();
  return out;
}

async function main() {
  const gate = checkLicense({ license: "public_domain", pub_year: 1737, author_death_years: [100, 1752] }, 2026);
  if (!gate.ok) throw new Error(gate.reason);
  const emb = getEmbeddingProvider();
  let total = 0;
  for (const work of Object.keys(WORKS) as WorkKey[]) {
    const info = WORKS[work];
    const raw = await text(info.gutenberg);
    const parsed = parseWork(work, stripGutenberg(raw));
    const words = parsed.sections.reduce((t, s) => t + s.text.split(" ").length, 0);
    console.log(`${work}: ${parsed.sections.length} sections, ${parsed.chapters.length} chapters, ${words} words`);
    for (const pl of PARALLELS.filter((x) => x.work === work)) {
      const sec = parsed.sections.find((x) => x.book === pl.book && x.chapter === pl.chapter && x.n === pl.n);
      if (!sec || !sec.text.toLowerCase().includes(pl.kw.toLowerCase())) console.log(`  !! parallel ${cite(work, pl.book, pl.chapter, pl.n)} ${sec ? `does not mention "${pl.kw}"` : "not found"}`);
    }
    if (DRY) continue;
    const wid = WORK_IDS[work];
    const credit = `Texto de domínio público: Flávio Josefo (séc. I), tradução inglesa de William Whiston (1737; Whiston faleceu em 1752). Fonte: Project Gutenberg, ebook nº ${info.gutenberg} (https://www.gutenberg.org/ebooks/${info.gutenberg}).`;
    await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
      values ('${wid}','${q(`Josephus, ${info.title} (Whiston)`)}',ARRAY['Flavius Josephus']::text[],ARRAY['William Whiston']::text[],ARRAY[100,1752]::int[],1737,'en','history','jewish','public_domain','${q(credit)}','https://www.gutenberg.org/ebooks/${info.gutenberg}',now(),'${createHash("sha256").update(raw).digest("hex")}',true,'approved')
      on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now(), enabled=true`);
    await nsql("insert into library_works (id, enabled) values ($1, true) on conflict (id) do nothing", [wid]);
    await nsql("delete from josephus_sections where work = $1", [work]);
    await nsql("delete from josephus_chapters where work = $1", [work]);
    for (let i = 0; i < parsed.sections.length; i += 150) {
      await nsql("insert into josephus_sections (work,book,chapter,n,text) select work,book,chapter,n,text from jsonb_to_recordset($1::jsonb) as t(work text,book int,chapter int,n int,text text) on conflict do nothing", [JSON.stringify(parsed.sections.slice(i, i + 150))]);
    }
    await nsql("insert into josephus_chapters (work,book,chapter,title) select work,book,chapter,title from jsonb_to_recordset($1::jsonb) as t(work text,book int,chapter int,title text) on conflict do nothing", [JSON.stringify(parsed.chapters)]);
    // search chunks: replace the old ones
    await nsql("delete from chunks where work_id = $1", [wid]);
    const all: ReturnType<typeof blocks> = [];
    const byChapter = new Map<string, Section[]>();
    for (const s of parsed.sections) { const k = `${s.book}.${s.chapter}`; (byChapter.get(k) ?? byChapter.set(k, []).get(k)!).push(s); }
    for (const secs of byChapter.values()) all.push(...blocks(work, secs));
    const titleOf = new Map(parsed.chapters.map((c) => [`${c.book}.${c.chapter}`, c.title]));
    for (let i = 0; i < all.length; i += 24) {
      const part = all.slice(i, i + 24);
      const vecs = await emb.embedPassages(part.map((c) => c.text));
      const payload = part.map((c, k) => {
        const [b, ch] = c.id.split(":")[1].split(".");
        const title = `Flavius Josephus (Flávio Josefo), ${EN[work]} (Whiston) > ${c.label}${titleOf.get(`${b}.${ch}`) ? `: ${titleOf.get(`${b}.${ch}`)}` : ""}`;
        return { id: c.id, work_id: wid, text: `${title}\n${c.text}`, language: "en", title_path: title, refs: `{${c.refs.map((r) => `"${r}"`).join(",")}}`, tradition: "jewish", kind: "history", license: "public_domain", tokens: approxTokens(c.text), embedding: `[${vecs[k].map((x) => x.toFixed(5)).join(",")}]` };
      });
      await nsql(
        `insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
         select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
         from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
         on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`,
        [JSON.stringify(payload)],
      );
    }
    total += all.length;
    console.log(`  stored ${all.length} chunks for ${wid}`);
  }
  if (!DRY) {
    await nsql("delete from chunks where work_id in ('pg_2846','pg_2848','pg_2850','pg_2847')");
    await nsql("update library_works set enabled = false where id in ('pg_2846','pg_2848','pg_2850','pg_2847')");
    await sql("update works set enabled = false where id in ('pg_2846','pg_2848','pg_2850','pg_2847')");
  }
  console.log(`done: ${total} chunks`);
}
main().catch((e) => { console.error(e); process.exit(1); });
