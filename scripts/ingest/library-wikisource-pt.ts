// Portuguese public-domain works from pt.wikisource.org for the library (decision 24/11/2026: eschatology in Portuguese). Same gate as the other ingestions
// (8.10.9, docs/LICENSES.md): author's death year <= 1931 and publication <= 1930. The text is a Wikisource transcription (CC BY-SA 4.0), credited.
// Chunks go to shard 2 (language "pt"); the `works` record to Supabase. Idempotent.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/library-wikisource-pt.ts --source vieira_futuro [--dry]
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { approxTokens, splitEntry } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { checkLicense } from "../../lib/knowledge/licenses";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { sql } from "../db.mjs";

const API = "https://pt.wikisource.org/w/api.php";
const UA = "ProfessorFilipeLibrary/1.0 (educational Bible-study app; polite bulk reader; contact via the app site)";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = process.argv.includes("--dry");
const q = (s: string) => s.replace(/'/g, "''");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Source { workId: string; title: string; prefix: string; authors: string[]; deaths: number[]; pubYear: number; kind: string; tradition: string; url: string; credit: string; minChars: number }
const SOURCES: Record<string, Source> = {
  vieira_futuro: {
    workId: "ws_pt_vieira_futuro", title: "História do Futuro, de Padre António Vieira", prefix: "História do Futuro/",
    authors: ["António Vieira"], deaths: [1697], pubYear: 1718, kind: "theology", tradition: "catholic", minChars: 600,
    url: "https://pt.wikisource.org/wiki/Hist%C3%B3ria_do_Futuro",
    credit: "História do Futuro, do Padre António Vieira (1608–1697), obra do século 17 sobre as profecias e o futuro do mundo, de domínio público (autor falecido em 1697). Texto da Wikisource em português (https://pt.wikisource.org/wiki/História_do_Futuro), transcrição sob CC BY-SA 4.0. Reflete a leitura católica jesuíta do século 17; o português é o da época.",
  },
};
const SRC = SOURCES[arg("--source") ?? "vieira_futuro"];
const DIR = `data/raw/wikisource/${SRC.workId}`;

type Json = { query: { allpages?: { title: string }[]; pages?: Record<string, { title: string; extract?: string }>; redirects?: { from: string; to: string }[] }; continue?: { apcontinue?: string } };
async function get(params: Record<string, string>): Promise<Json> {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    let wait = 20;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) return JSON.parse(text);
      wait = Math.max(Number(res.headers.get("retry-after")) || 0, 10) + Math.random() * 5;
    } catch { /* retry */ }
    await sleep(wait * 1000);
  }
  throw new Error("wikisource: too many failures");
}
async function listTitles(): Promise<string[]> {
  const path = `${DIR}/titles.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const titles: string[] = []; let cont: string | undefined;
  do {
    const j = await get({ action: "query", list: "allpages", apprefix: SRC.prefix, aplimit: "500", ...(cont ? { apcontinue: cont } : {}) });
    for (const p of j.query.allpages ?? []) titles.push(p.title);
    cont = j.continue?.apcontinue; await sleep(4000);
  } while (cont);
  writeFileSync(path, JSON.stringify(titles));
  return titles;
}
async function readAll(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>(); const cache = `${DIR}/bodies.jsonl`;
  if (existsSync(cache)) for (const l of readFileSync(cache, "utf8").split("\n")) if (l) { const [t, b] = JSON.parse(l) as [string, string]; out.set(t, b); }
  const todo = titles.filter((t) => !out.get(t));
  console.log(`titles ${titles.length}; cached ${out.size}; to read ${todo.length}`);
  // TextExtracts returns the full text of only ONE page per request (more than one only with exintro), so one title at a time
  for (let i = 0; i < todo.length; i += 1) {
    const batch = todo.slice(i, i + 1);
    const j = await get({ action: "query", titles: batch.join("|"), prop: "extracts", explaintext: "1", exlimit: "max", redirects: "1" });
    const byTitle = new Map<string, string>();
    for (const p of Object.values(j.query.pages ?? {})) byTitle.set(p.title, p.extract ?? "");
    const redirects = new Map<string, string>((j.query.redirects ?? []).map((r) => [r.from, r.to]));
    const lines: string[] = [];
    for (const t of batch) { const body = byTitle.get(redirects.get(t) ?? t) ?? ""; out.set(t, body); lines.push(JSON.stringify([t, body])); }
    appendFileSync(cache, lines.join("\n") + "\n"); await sleep(3000);
  }
  return out;
}
const clean = (s: string) => s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/^=+\s*(.*?)\s*=+$/gm, "$1:").replace(/[ \t]+/g, " ").trim();

function dst() {
  const url = process.env.NEON_OWNER_URL_2; if (!url) throw new Error("NEON_OWNER_URL_2 not set");
  const host = new URL(url).host;
  return async (text: string, params: unknown[] = []) => {
    for (let a = 0; a < 4; a++) {
      const res = await fetch(`https://${host}/sql`, { method: "POST", headers: { "Content-Type": "application/json", "Neon-Connection-String": url }, body: JSON.stringify({ query: text, params }) });
      const body = await res.text();
      if (res.ok) return JSON.parse(body);
      if (res.status >= 500 || res.status === 429) { await sleep(2000 * (a + 1)); continue; }
      throw new Error(`Neon SQL failed (${res.status}): ${body.slice(0, 300)}`);
    }
    throw new Error("Neon SQL failed after retries");
  };
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const gate = checkLicense({ license: "public_domain", pub_year: SRC.pubYear, author_death_years: SRC.deaths }, 2026);
  if (!gate.ok) throw new Error(`license gate: ${gate.reason}`);
  const titles = (await listTitles()).filter((t) => t.length > SRC.prefix.length + 1);
  const bodies = await readAll(titles);
  const pages = [...bodies].map(([t, raw]) => ({ title: t.slice(SRC.prefix.length), body: clean(raw) })).filter((p) => p.body.length >= SRC.minChars);
  console.log(`pages with text: ${pages.length} of ${titles.length}; ${pages.reduce((n, p) => n + p.body.length, 0)} characters`);
  if (DRY) { for (const p of pages.slice(0, 8)) console.log(`${p.body.length}\t${p.title}`); return; }
  const raw = createHash("sha256").update(titles.join("\n")).digest("hex");
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('${SRC.workId}','${q(SRC.title)}',ARRAY[${SRC.authors.map((a) => `'${q(a)}'`).join(",")}]::text[],'{}',ARRAY[${SRC.deaths.join(",")}]::int[],${SRC.pubYear},'pt','${SRC.kind}','${SRC.tradition}','public_domain','${q(SRC.credit)}','${SRC.url}',now(),'${raw}',true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now(), enabled=true`);
  const db = dst();
  await db("insert into library_works (id, enabled) values ($1, true) on conflict (id) do update set enabled = true", [SRC.workId]);
  await db("delete from chunks where work_id = $1", [SRC.workId]);
  const emb = getEmbeddingProvider();
  let stored = 0;
  for (const p of pages) {
    const titlePath = `${SRC.title} > ${p.title.replace(/\//g, " > ")}`;
    const id = `${SRC.workId}:${createHash("sha1").update(p.title).digest("hex").slice(0, 8)}`;
    const blocks = splitEntry(titlePath, p.body);
    const rows = blocks.map((block, k) => ({ id: `${id}:${k}`, text: block, refs: [...new Set(findReferences(block, { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs))].slice(0, 40) }));
    for (let i = 0; i < rows.length; i += 16) {
      const part = rows.slice(i, i + 16);
      const vecs = await emb.embedPassages(part.map((r) => r.text));
      const payload = part.map((r, k) => ({ id: r.id, work_id: SRC.workId, text: r.text, language: "pt", title_path: titlePath, refs: `{${r.refs.map((x) => `"${x}"`).join(",")}}`, tradition: SRC.tradition, kind: SRC.kind, license: "public_domain", tokens: approxTokens(r.text), embedding: `[${vecs[k].map((v) => v.toFixed(6)).join(",")}]` }));
      await db(`insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
        select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
        from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
        on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`, [JSON.stringify(payload)]);
      stored += part.length;
    }
  }
  appendFileSync("data/raw/gutenberg/ingested.tsv", `${SRC.workId}\t${SRC.kind}\t${SRC.tradition}\t${stored}\t${SRC.title}\n`);
  console.log(`done: ${pages.length} pages, ${stored} chunks`);
}
main().catch((e) => { console.error(e); process.exit(1); });
