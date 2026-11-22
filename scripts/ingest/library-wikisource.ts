// Library ingestion from Wikisource (public-domain encyclopedias and dictionaries) into the Neon library: list the pages of a work by prefix,
// read the plain text in batches of 20 (MediaWiki TextExtracts, politely throttled), keep the articles that matter for Bible study
// (they cite many Bible passages, or are named in the topic list), split them into chunks with Bible references, embed and store.
// Same gate and storage as the Gutenberg ingestion: license check (8.10.9), `works` record in Supabase, chunks in Neon. Idempotent.
//
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/library-wikisource.ts --source cathen [--budget-chunks N] [--min-refs N] [--max-articles N] [--dry]
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { approxTokens, splitEntry } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { checkLicense } from "../../lib/knowledge/licenses";
import { modernizeCitations } from "../../lib/knowledge/old-citations";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const API = "https://en.wikisource.org/w/api.php";
const UA = "ProfessorFilipeLibrary/1.0 (educational Bible-study app; polite bulk reader; contact via the app site)";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const q = (s: string) => s.replace(/'/g, "''");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Source { workId: string; title: string; prefix: string; authors: string[]; deaths: number[]; pubYear: number; kind: string; tradition: string; url: string; credit: string }
const SOURCES: Record<string, Source> = {
  cathen: {
    workId: "ws_cathen", title: "The Catholic Encyclopedia (1907–1914)", prefix: "Catholic Encyclopedia (1913)/",
    authors: ["Charles G. Herbermann", "Edward A. Pace", "Condé B. Pallen", "Thomas J. Shahan", "John J. Wynne"], deaths: [1925, 1938, 1929, 1932, 1951], pubYear: 1913, kind: "encyclopedia", tradition: "catholic",
    url: "https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)",
    credit: "Obra coletiva de domínio público (publicada em 1907–1914; editores falecidos até 1951). Texto da Wikisource (https://en.wikisource.org/wiki/Catholic_Encyclopedia_(1913)), transcrição sob CC BY-SA 4.0. Reflete a tradição católica de 1913.",
  },
};

const SRC = SOURCES[arg("--source") ?? "cathen"];
if (!SRC) throw new Error("unknown --source");
const DIR = `data/raw/wikisource/${SRC.workId}`;
const MIN_REFS = Number(arg("--min-refs") ?? 3);
const BUDGET = Number(arg("--budget-chunks") ?? 12000);
const MAX_ARTICLES = Number(arg("--max-articles") ?? 100000);
const MAX_CHUNKS_PER_ARTICLE = Number(arg("--max-per-article") ?? 8);

type Json = { query: { allpages: { title: string }[]; pages?: Record<string, { title: string; extract?: string }>; redirects?: { from: string; to: string }[] }; continue?: { apcontinue?: string } };
async function get(params: Record<string, string>): Promise<Json> {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    let wait = 20;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) return JSON.parse(text);
      // the site is shared with many readers: obey its Retry-After
      wait = Math.max(Number(res.headers.get("retry-after")) || 0, 10) + Math.random() * 5;
    } catch { /* retry */ }
    await sleep(wait * 1000);
  }
  throw new Error("wikisource: too many failures");
}

async function listTitles(): Promise<string[]> {
  const path = `${DIR}/titles.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const j = await get({ action: "query", list: "allpages", apprefix: SRC.prefix, aplimit: "500", ...(cont ? { apcontinue: cont } : {}) });
    for (const p of j.query.allpages) titles.push(p.title);
    cont = j.continue?.apcontinue;
    await sleep(4000);
  } while (cont);
  writeFileSync(path, JSON.stringify(titles));
  return titles;
}

async function readAll(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const cache = `${DIR}/bodies.jsonl`;
  if (existsSync(cache)) for (const l of readFileSync(cache, "utf8").split("\n")) if (l) { const [t, b] = JSON.parse(l) as [string, string]; out.set(t, b); }
  const todo = titles.filter((t) => !out.has(t));
  console.log(`titles ${titles.length}; cached ${out.size}; to read ${todo.length}`);
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const j = await get({ action: "query", titles: batch.join("|"), prop: "extracts", explaintext: "1", exlimit: "max", redirects: "1" });
    const byTitle = new Map<string, string>();
    for (const p of Object.values(j.query.pages ?? {})) byTitle.set(p.title, p.extract ?? "");
    const redirects = new Map<string, string>((j.query.redirects ?? []).map((r) => [r.from, r.to]));
    const lines: string[] = [];
    for (const t of batch) { const body = byTitle.get(redirects.get(t) ?? t) ?? ""; out.set(t, body); lines.push(JSON.stringify([t, body])); }
    appendFileSync(cache, lines.join("\n") + "\n");
    if ((i / 20) % 25 === 0) console.log(`read ${out.size}/${titles.length}`);
    await sleep(4000);
  }
  return out;
}

const clean = (s: string) => s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/^=+\s*(.*?)\s*=+$/gm, "$1:").replace(/[ \t]+/g, " ").trim();

async function main() {
  mkdirSync(DIR, { recursive: true });
  const gate = checkLicense({ license: "public_domain", pub_year: SRC.pubYear, author_death_years: SRC.deaths }, 2026);
  if (!gate.ok) throw new Error(`license gate: ${gate.reason}`);
  const titles = (await listTitles()).filter((t) => t.length > SRC.prefix.length + 1);
  const bodies = await readAll(titles);
  // selection: articles that cite the Bible
  const scored: { title: string; body: string; refs: string[]; n: number }[] = [];
  for (const [title, raw] of bodies) {
    const body = clean(raw);
    if (body.length < 400) continue;
    const refs = [...new Set(findReferences(modernizeCitations(body), { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs))];
    const books = new Set(refs.map((r) => r.split(".")[0]));
    if (refs.length >= MIN_REFS && books.size >= 1) scored.push({ title: title.slice(SRC.prefix.length), body, refs, n: refs.length });
  }
  scored.sort((a, b) => b.n - a.n);
  console.log(`articles read ${bodies.size}; citing >= ${MIN_REFS} passages: ${scored.length}`);
  if (DRY) { for (const s of scored.slice(0, 25)) console.log(`${s.n}\t${s.title}`); return; }

  const raw = createHash("sha256").update(titles.join("\n")).digest("hex");
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('${SRC.workId}','${q(SRC.title)}',ARRAY[${SRC.authors.map((a) => `'${q(a)}'`).join(",")}]::text[],'{}',ARRAY[${SRC.deaths.join(",")}]::int[],${SRC.pubYear},'en','${SRC.kind}','${SRC.tradition}','public_domain','${q(SRC.credit)}','${SRC.url}',now(),'${raw}',true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now()`);
  await nsql("insert into library_works (id, enabled) values ($1, true) on conflict (id) do nothing", [SRC.workId]);

  const emb = getEmbeddingProvider();
  const done = new Set<string>((await nsql("select title_path from chunks where work_id = $1 and id like '%:0'", [SRC.workId])).map((r: Record<string, unknown>) => String(r.title_path)));
  let stored = 0, articles = 0;
  for (const a of scored) {
    if (stored >= BUDGET || articles >= MAX_ARTICLES) break;
    const titlePath = `${SRC.title} > ${a.title}`;
    if (done.has(titlePath)) continue;
    const id = `${SRC.workId}:${createHash("sha1").update(a.title).digest("hex").slice(0, 8)}`;
    const blocks = splitEntry(titlePath, a.body).slice(0, MAX_CHUNKS_PER_ARTICLE);
    const rows = blocks.map((block, k) => ({ id: `${id}:${k}`, text: block, refs: [...new Set(findReferences(modernizeCitations(block), { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs))].slice(0, 40) }));
    const vecs = await emb.embedPassages(rows.map((r) => r.text));
    const payload = rows.map((r, k) => ({ id: r.id, work_id: SRC.workId, text: r.text, language: "en", title_path: titlePath, refs: `{${r.refs.map((x) => `"${x}"`).join(",")}}`, tradition: SRC.tradition, kind: SRC.kind, license: "public_domain", tokens: approxTokens(r.text), embedding: `[${vecs[k].map((x) => x.toFixed(5)).join(",")}]` }));
    await nsql(
      `insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
       select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
       from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
       on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`,
      [JSON.stringify(payload)],
    );
    stored += rows.length; articles++;
    if (articles % 50 === 0) console.log(`stored ${articles} articles, ${stored} chunks (last: ${a.title})`);
  }
  const [{ s }] = await nsql("select pg_size_pretty(pg_database_size(current_database())) s");
  appendFileSync("data/raw/gutenberg/ingested.tsv", `${SRC.workId}\t${SRC.kind}\t${SRC.tradition}\t${stored}\t${SRC.title}\n`);
  console.log(`done: ${articles} articles, ${stored} chunks; Neon size ${s}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
