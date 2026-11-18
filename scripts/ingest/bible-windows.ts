// Builds semantic-search windows (spec 8.10.3: pericope windows of 3-8 verses) for Bible versions and embeds them.
// Usage: tsx scripts/ingest/bible-windows.ts [versionId ...]   (default: the prototype versions)
import { approxTokens } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { formatRefPt } from "../../lib/knowledge/refs-parser";
import { sql } from "../db.mjs";

const DEFAULT_VERSIONS = ["por_blivre_2018", "eng_web"];
const WINDOW = 5;
const MAX = 8;

interface V {
  book_code: string;
  chapter: number;
  verse: number;
  text: string;
}

function windowsOf(verses: V[]): V[][] {
  const out: V[][] = [];
  let i = 0;
  while (i < verses.length) {
    let end = Math.min(i + WINDOW, verses.length);
    // merge a short tail (1-2 verses) into the previous window, up to MAX
    if (verses.length - end > 0 && verses.length - end < 3 && end - i + (verses.length - end) <= MAX) end = verses.length;
    out.push(verses.slice(i, end));
    i = end;
  }
  return out;
}

async function main() {
  const versions = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_VERSIONS;
  const emb = getEmbeddingProvider();
  for (const versionId of versions) {
    const [ver] = await sql(`select v.id, v.language, w.id work_id, w.license, w.name from bible_versions v join works w on w.id=v.work_id where v.id='${versionId}'`);
    if (!ver) {
      console.log(`SKIP ${versionId}: not found`);
      continue;
    }
    const all: V[] = await sql(`select book_code, chapter, verse, text from bible_verses where version_id='${versionId}' order by book_code, chapter, verse`);
    const byChapter = new Map<string, V[]>();
    for (const v of all) {
      const k = `${v.book_code}.${v.chapter}`;
      byChapter.set(k, [...(byChapter.get(k) ?? []), v]);
    }
    const rows: Record<string, unknown>[] = [];
    for (const [, verses] of byChapter) {
      for (const w of windowsOf(verses)) {
        const first = w[0];
        const last = w[w.length - 1];
        const base = `${first.book_code}.${first.chapter}`;
        const label = formatRefPt(first.verse === last.verse ? `${base}.${first.verse}` : `${base}.${first.verse}-${base}.${last.verse}`);
        const text = `${label}\n${w.map((v) => `${v.verse} ${v.text}`).join(" ")}`;
        const refs = [...w.map((v) => `${base}.${v.verse}`), base];
        rows.push({
          id: `${ver.work_id}:w:${base}.${first.verse}`,
          work_id: ver.work_id,
          text,
          language: ver.language,
          title_path: `${ver.name} — ${label}`,
          refs: `{${refs.join(",")}}`,
          tradition: "general",
          kind: "bible_text",
          license: ver.license,
          tokens: approxTokens(text),
        });
      }
    }
    console.log(`${versionId}: ${rows.length} windows`);
    const B = 100;
    for (let i = 0; i < rows.length; i += B) {
      const part = rows.slice(i, i + B);
      const vecs = await emb.embedPassages(part.map((r) => r.text as string));
      const payload = part.map((r, k) => ({ ...r, embedding: `[${vecs[k].map((x) => x.toFixed(6)).join(",")}]` }));
      await sql(`insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
        select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector from jsonb_to_recordset($j$${JSON.stringify(payload)}$j$::jsonb)
        as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
        on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`);
      if ((i / B) % 10 === 0) console.log(`  ${versionId} ${Math.min(i + B, rows.length)}/${rows.length}`);
    }
    console.log(`OK windows ${versionId}: ${rows.length}`);
  }
}
main();
