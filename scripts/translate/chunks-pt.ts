// Machine translation (free, local Opus-MT) of chosen library works into Portuguese, as "twin" chunks: same ids with ":pt:" (the search prefers the Portuguese twin).
// Used for the eschatology works the owner asked to have in Portuguese (decision 24/11/2026). Chunks come from shard 1 (English), twins go to shard 2.
// Steps:  export  -> data/translate/chunks/in.jsonl         (one unit per chunk: title and paragraphs)
//         (then)  /opt/mt/bin/python scripts/translate/mt-local.py data/translate/chunks/in.jsonl data/translate/chunks/out.jsonl
//         ingest  -> reads out.jsonl, embeds, writes the Portuguese chunks to shard 2 (idempotent)
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/translate/chunks-pt.ts export|ingest
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { approxTokens } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { nsql } from "../neon.mjs";

const DIR = "data/translate/chunks";
/** work -> [title in Portuguese, SQL filter on title_path (null = whole work)] */
export const WORKS: Record<string, { title: string; filter: string | null }> = {
  pg_45283: { title: "Teologia Sistemática, de Augustus H. Strong, volume 3", filter: "title_path ilike '%ESCHATOLOGY%'" },
  pg_26639: { title: "Breve Comentário sobre o Apocalipse", filter: null },
  pg_14485: { title: "Notas sobre o Apocalipse", filter: null },
  pg_42251: { title: "A Bíblia do Expositor: O Livro do Apocalipse", filter: null },
};
const step = process.argv[2];

function dst() {
  const url = process.env.NEON_OWNER_URL_2; if (!url) throw new Error("NEON_OWNER_URL_2 not set");
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

async function exportUnits() {
  mkdirSync(DIR, { recursive: true });
  const lines: string[] = [];
  for (const [work, w] of Object.entries(WORKS)) {
    const rows = (await nsql(`select id, title_path, text, tradition from chunks where work_id='${work}' and language='en' ${w.filter ? `and ${w.filter}` : ""} order by id`)) as { id: string; title_path: string; text: string }[];
    for (const r of rows) {
      const path = (r.title_path ?? "").split(" > ").slice(1).join(" > ");
      const body = r.text.startsWith(r.title_path ?? "\u0000") ? r.text.slice(r.title_path.length).trim() : r.text.replace(/^[^\n]*\n/, "");
      const secs = [{ n: 0, text: path || w.title }, ...body.split(/\n+/).filter((p) => p.trim()).map((p, i) => ({ n: i + 1, text: p.trim() }))];
      lines.push(JSON.stringify({ id: r.id, secs }));
    }
    console.log(`${work}: ${rows.length} chunks`);
  }
  writeFileSync(`${DIR}/in.jsonl`, lines.join("\n") + "\n");
  console.log(`${lines.length} units written to ${DIR}/in.jsonl`);
}

async function ingest() {
  if (!existsSync(`${DIR}/out.jsonl`)) throw new Error("run the translator first (out.jsonl missing)");
  const db = dst();
  const answers = new Map<string, string>();
  for (const l of readFileSync(`${DIR}/out.jsonl`, "utf8").split("\n")) { if (!l.trim()) continue; const j = JSON.parse(l); answers.set(j.id, j.answer); }
  const meta = new Map<string, { work_id: string; tradition: string; refs: string[]; kind: string }>();
  for (const work of Object.keys(WORKS)) {
    const rows = (await nsql(`select id, work_id, tradition, kind, refs from chunks where work_id='${work}' and language='en'`)) as { id: string; work_id: string; tradition: string; kind: string; refs: string[] }[];
    for (const r of rows) meta.set(r.id, r);
  }
  const emb = getEmbeddingProvider();
  const out: { id: string; work_id: string; title: string; text: string; refs: string[]; tradition: string; kind: string }[] = [];
  for (const [id, ans] of answers) {
    const m = meta.get(id); if (!m) continue;
    const parts = ans.split(/\[§(\d+)\]/).slice(1);
    const sec = new Map<number, string>();
    for (let i = 0; i + 1 < parts.length; i += 2) sec.set(Number(parts[i]), parts[i + 1].trim());
    const fixText = (t: string) => t.replace(/ESCAT\s*LOGIA/g, "ESCATOLOGIA").replace(/Escat\s*logia/g, "Escatologia").replace(/\s⁇\s/g, " ");
    const path0 = sec.get(0); if (!path0) continue;
    const path = fixText(path0);
    const body = fixText([...sec.entries()].filter(([n]) => n > 0).sort((a, b) => a[0] - b[0]).map(([, t]) => t).join("\n\n"));
    if (body.length < 40) continue;
    const i = id.indexOf(":");
    const title = `${WORKS[m.work_id].title} (tradução automática para o português) > ${path}`;
    const refs = [...new Set([...(m.refs ?? []), ...findReferences(body).flatMap((r) => r.refs)])].slice(0, 40);
    out.push({ id: `${id.slice(0, i)}:pt:${id.slice(i + 1)}`, work_id: m.work_id, title, text: `${title}\n${body}`, refs, tradition: m.tradition, kind: m.kind });
  }
  console.log(`${out.length} Portuguese chunks to write`);
  for (const w of Object.keys(WORKS)) await db("insert into library_works (id, enabled) values ($1, true) on conflict (id) do update set enabled = true", [w]);
  for (let i = 0; i < out.length; i += 24) {
    const part = out.slice(i, i + 24);
    const vecs = await emb.embedPassages(part.map((c) => c.text));
    const payload = part.map((c, k) => ({ id: c.id, work_id: c.work_id, text: c.text, language: "pt", title_path: c.title, refs: `{${c.refs.map((r) => `"${r}"`).join(",")}}`, tradition: c.tradition, kind: c.kind, license: "public_domain", tokens: approxTokens(c.text), embedding: `[${vecs[k].map((v) => v.toFixed(6)).join(",")}]` }));
    await db(`insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
      select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
      from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
      on conflict (id) do update set text=excluded.text, title_path=excluded.title_path, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`, [JSON.stringify(payload)]);
    console.log(`${Math.min(i + 24, out.length)}/${out.length}`);
  }
}
(step === "export" ? exportUnits() : step === "ingest" ? ingest() : Promise.reject(new Error("usage: export|ingest"))).catch((e) => { console.error(e); process.exit(1); });
