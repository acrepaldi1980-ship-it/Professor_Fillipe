// Loads the "core" search tables of Neon (shard 2): Bible windows (Portuguese and English) and Easton's dictionary, the content that used to be searched on Supabase.
// Same chunking, ids, texts and embeddings as scripts/ingest/bible-windows.ts and easton.ts (it reads the verses through the public API, so it needs no database token).
// Idempotent. Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/core-neon.ts [--only bible|easton]
import { readFileSync } from "node:fs";
import { approxTokens, splitEntry } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { expandRefs, findReferences, formatRefPt } from "../../lib/knowledge/refs-parser";

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
const WINDOW = 5, MAX = 8;
const VERSIONS = ["por_blivre_2018", "eng_web"];

function neon() {
  const url = process.env.NEON_OWNER_URL_2;
  if (!url) throw new Error("NEON_OWNER_URL_2 is not set (load .env.local)");
  const host = new URL(url).host;
  return async (text: string, params: unknown[] = []) => {
    for (let a = 0; a < 4; a++) {
      const res = await fetch(`https://${host}/sql`, { method: "POST", headers: { "Content-Type": "application/json", "Neon-Connection-String": url }, body: JSON.stringify({ query: text, params }) });
      const body = await res.text();
      if (res.ok) return JSON.parse(body);
      if (res.status >= 500 || res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (a + 1))); continue; }
      throw new Error(`Neon SQL failed (${res.status}): ${body.slice(0, 300)}`);
    }
    throw new Error("Neon SQL failed after retries");
  };
}
async function rest<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SB}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: { apikey: KEY } });
    if (!res.ok) throw new Error(`rest ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

interface V { book_code: string; chapter: number; verse: number; text: string }
function windowsOf(verses: V[]): V[][] {
  const out: V[][] = [];
  let i = 0;
  while (i < verses.length) {
    let end = Math.min(i + WINDOW, verses.length);
    if (verses.length - end > 0 && verses.length - end < 3 && end - i + (verses.length - end) <= MAX) end = verses.length;
    out.push(verses.slice(i, end));
    i = end;
  }
  return out;
}
type Row = { id: string; work_id: string; text: string; language: string; title_path: string; refs: string[]; tradition: string; kind: string; license: string; tokens: number };

async function bibleRows(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const versionId of VERSIONS) {
    const [ver] = await rest<{ id: string; name: string; language: string; work_id: string }>(`bible_versions?id=eq.${versionId}&select=id,name,language,work_id`);
    const [work] = await rest<{ id: string; license: string }>(`works?id=eq.${ver.work_id}&select=id,license`);
    const all = await rest<V>(`bible_verses?version_id=eq.${versionId}&select=book_code,chapter,verse,text&order=book_code,chapter,verse`);
    console.log(`${versionId}: ${all.length} verses`);
    const byChapter = new Map<string, V[]>();
    for (const v of all) { const k = `${v.book_code}.${v.chapter}`; byChapter.set(k, [...(byChapter.get(k) ?? []), v]); }
    for (const [, verses] of byChapter) {
      for (const w of windowsOf(verses)) {
        const first = w[0], last = w[w.length - 1];
        const base = `${first.book_code}.${first.chapter}`;
        const label = formatRefPt(first.verse === last.verse ? `${base}.${first.verse}` : `${base}.${first.verse}-${base}.${last.verse}`);
        const text = `${label}\n${w.map((v) => `${v.verse} ${v.text}`).join(" ")}`;
        rows.push({ id: `${ver.work_id}:w:${base}.${first.verse}`, work_id: ver.work_id, text, language: ver.language, title_path: `${ver.name} — ${label}`, refs: [...w.map((v) => `${base}.${v.verse}`), base], tradition: "general", kind: "bible_text", license: work.license, tokens: approxTokens(text) });
      }
    }
  }
  return rows;
}

function eastonRows(): Row[] {
  const entries = JSON.parse(readFileSync("data/raw/easton.json", "utf8")) as { fields: { termLabel: string; dictText: string; termID: string; itemNum: number } }[];
  const terms = new Map<string, { label: string; texts: string[] }>();
  for (const e of entries.sort((a, b) => a.fields.itemNum - b.fields.itemNum)) {
    const f = e.fields;
    if (!f.dictText) continue;
    const t = terms.get(f.termID) ?? { label: f.termLabel, texts: [] };
    t.texts.push(f.dictText);
    terms.set(f.termID, t);
  }
  const rows: Row[] = [];
  let n = 0;
  for (const [, t] of terms) {
    const body = t.texts.join(" ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
    for (const text of splitEntry(t.label, body)) {
      const refs = expandRefs(findReferences(text).flatMap((r) => r.refs)).slice(0, 400);
      rows.push({ id: `easton_1897:${n++}`, work_id: "easton_1897", text, language: "en", title_path: t.label, refs, tradition: "general", kind: "dictionary", license: "cc_by_sa", tokens: approxTokens(text) });
    }
  }
  return rows;
}

async function main() {
  const db = neon();
  const rows = [...(ONLY === "easton" ? [] : await bibleRows()), ...(ONLY === "bible" ? [] : eastonRows())];
  console.log(`${rows.length} chunks to load`);
  for (const w of new Set(rows.map((r) => r.work_id))) await db("insert into core_works (id, enabled) values ($1, true) on conflict (id) do update set enabled = true", [w]);
  const emb = getEmbeddingProvider();
  const B = 64;
  for (let i = 0; i < rows.length; i += B) {
    const part = rows.slice(i, i + B);
    const vecs = await emb.embedPassages(part.map((r) => r.text));
    const payload = part.map((r, k) => ({ ...r, refs: `{${r.refs.map((x) => `"${x}"`).join(",")}}`, embedding: `[${vecs[k].map((x) => x.toFixed(6)).join(",")}]` }));
    await db(`insert into core_chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
      select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
      from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
      on conflict (id) do update set text=excluded.text, title_path=excluded.title_path, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`, [JSON.stringify(payload)]);
    if ((i / B) % 20 === 0) console.log(`${Math.min(i + B, rows.length)}/${rows.length}`);
  }
  const r = await db("select kind, count(*) n from core_chunks group by 1");
  console.log("done:", JSON.stringify(r.rows ?? r));
}
main().catch((e) => { console.error(e); process.exit(1); });
