// Indexes the app's OWN content (characters, curiosities, archaeology, 3D environments and tours, 3D models, timelines, routes, study paths, historians, Josephus guide)
// so the teacher can answer from all of it, whichever screen the student is on. Chunks go to the library shard with room (shard 2) as kind "own_notes";
// each section is also registered in the works catalogue (Supabase) with its credit. Idempotent: re-running replaces the chunks of these sections.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/app-content.ts [--dry]
import { createHash } from "node:crypto";
import { approxTokens } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { collectAppContent, SECTIONS } from "../../lib/appcontent/collect";
import { sql } from "../db.mjs";

const DRY = process.argv.includes("--dry");
const q = (s: string) => s.replace(/'/g, "''");

function neon(url: string | undefined) {
  if (!url) throw new Error("NEON_OWNER_URL_2 is not set (load .env.local)");
  const host = new URL(url).host;
  return async (text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`https://${host}/sql`, { method: "POST", headers: { "Content-Type": "application/json", "Neon-Connection-String": url }, body: JSON.stringify({ query: text, params }) });
      const body = await res.text();
      if (res.ok) { const j = JSON.parse(body); return (j.rows ?? []).map((r: unknown) => (Array.isArray(r) ? Object.fromEntries(j.fields.map((f: { name: string }, i: number) => [f.name, r[i]])) : r)); }
      if (res.status >= 500 || res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      throw new Error(`Neon SQL failed (${res.status}): ${body.slice(0, 300)}`);
    }
    throw new Error("Neon SQL failed after retries");
  };
}

async function main() {
  const records = collectAppContent();
  console.log(`${records.length} records in ${new Set(records.map((r) => r.section)).size} sections`);
  if (DRY) return;
  const db = neon(process.env.NEON_OWNER_URL_2);
  const workIds = Object.values(SECTIONS).map((s) => s.workId);
  const hash = createHash("sha256").update(JSON.stringify(records)).digest("hex");
  for (const s of Object.values(SECTIONS)) {
    await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
      values ('${s.workId}','${q(s.title)}',ARRAY['Professor Filipe (conteúdo próprio do app)']::text[],ARRAY[]::text[],ARRAY[]::int[],2026,'pt','own_notes','general','licensed','${q(`${s.title}. Conteúdo próprio do app Professor Filipe, escrito a partir da Bíblia e de fontes de domínio público ou licença aberta citadas em cada tela.`)}','https://professor-filipe.vercel.app',now(),'${hash}',true,'approved')
      on conflict (id) do update set title=excluded.title, credit_text=excluded.credit_text, collected_at=now(), file_hash=excluded.file_hash, enabled=true`);
    await db("insert into library_works (id, enabled) values ($1, true) on conflict (id) do update set enabled = true", [s.workId]);
  }
  await db("delete from chunks where work_id = any ($1::text[])", [`{${workIds.join(",")}}`]);
  const emb = getEmbeddingProvider();
  for (let i = 0; i < records.length; i += 24) {
    const part = records.slice(i, i + 24);
    const items = part.map((r) => { const title = `${SECTIONS[r.section].title} > ${r.title} (tela: ${r.url})`; return { r, title, text: `${title}\n${r.text}` }; });
    const vecs = await emb.embedPassages(items.map((x) => x.text));
    const payload = items.map((x, k) => ({ id: x.r.id, work_id: SECTIONS[x.r.section].workId, text: x.text, language: "pt", title_path: x.title, refs: `{${x.r.refs.map((r) => `"${r}"`).join(",")}}`, tradition: "general", kind: "own_notes", license: "licensed", tokens: approxTokens(x.text), embedding: `[${vecs[k].map((v) => v.toFixed(6)).join(",")}]` }));
    await db(
      `insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
       select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
       from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
       on conflict (id) do update set text=excluded.text, title_path=excluded.title_path, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`,
      [JSON.stringify(payload)],
    );
    console.log(`${Math.min(i + 24, records.length)}/${records.length}`);
  }
  console.log(`done: ${records.length} app-content chunks in ${workIds.length} sections`);
}
main().catch((e) => { console.error(e); process.exit(1); });
