// Portuguese search index (library chunks with language = 'pt'): the machine translation of Josephus and of the historians, cut into blocks and
// embedded with the same multilingual model as everything else. Josephus blocks use the SAME section boundaries as the English blocks (ids differ only by
// ":pt"), so the search can tell that a Portuguese block and its English twin are the same passage. Written to shard 2 (the one with room).
// Suetonius is left out of the search until his license is confirmed (docs/LICENSES.md). Idempotent.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/library-pt.ts [--dry] [--only jos|hist]
import { approxTokens } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { PARALLELS } from "../../lib/josephus/books";
import { cite, type WorkKey } from "../../lib/josephus/structure";

const DRY = process.argv.includes("--dry");
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";

/** SQL over Neon's HTTPS endpoint for one database (the sources are in shard 1, the chunks go to shard 2). */
function db(url: string | undefined) {
  if (!url) throw new Error("NEON_OWNER_URL / NEON_OWNER_URL_2 are not set (load .env.local)");
  const host = new URL(url).host;
  return async (text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`https://${host}/sql`, { method: "POST", headers: { "Content-Type": "application/json", "Neon-Connection-String": url }, body: JSON.stringify({ query: text, params }) });
      const body = await res.text();
      if (res.ok) { const j = JSON.parse(body); return (j.rows ?? []).map((r: unknown) => (Array.isArray(r) ? Object.fromEntries(j.fields.map((f: { name: string }, i: number) => [f.name, r[i]])) : r)); }
      if (res.status >= 500 || res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      throw new Error(`Neon SQL failed (${res.status}): ${body.slice(0, 400)}`);
    }
    throw new Error("Neon SQL failed after retries");
  };
}
const src = db(process.env.NEON_OWNER_URL);
const dst = db(process.env.NEON_OWNER_URL_2);

const WORK_IDS: Record<WorkKey, string> = { ant: "jos_ant", war: "jos_war", life: "jos_life", apion: "jos_apion" };
const JOS_PT: Record<WorkKey, string> = { ant: "Antiguidades Judaicas", war: "A Guerra dos Judeus", life: "Vida de Flávio Josefo", apion: "Contra Apião" };
const HIST: Record<string, { workId: string; author: string; title: string }> = {
  he: { workId: "ccel_eusebius", author: "Eusébio de Cesareia", title: "História Eclesiástica" },
  vc: { workId: "ccel_eusebius", author: "Eusébio de Cesareia", title: "Vida de Constantino" },
  annals: { workId: "pg_7959", author: "Tácito", title: "Anais (livros 1 a 6)" },
  germania: { workId: "pg_7524", author: "Tácito", title: "Germânia" },
  agricola: { workId: "pg_7524", author: "Tácito", title: "Agrícola" },
  letters: { workId: "pg_2811", author: "Plínio, o Jovem", title: "Cartas" },
  trajan: { workId: "pg_2811", author: "Plínio, o Jovem", title: "Correspondência com Trajano" },
};

interface Chunk { id: string; work_id: string; title: string; text: string; refs: string[]; tradition: string }
const refsOf = (body: string, extra: string[] = []) => [...new Set([...extra, ...findReferences(body, { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs)])].slice(0, 40);

async function josephusChunks(): Promise<Chunk[]> {
  const secs = (await src("select work, book, chapter, n, text, text_pt from josephus_sections where text_pt is not null order by work, book, chapter, n")) as { work: WorkKey; book: number; chapter: number; n: number; text: string; text_pt: string }[];
  const titles = new Map((await src("select work, book, chapter, title_pt from josephus_chapters")).map((r) => [`${r.work}.${r.book}.${r.chapter}`, r.title_pt as string | null]));
  const byChapter = new Map<string, typeof secs>();
  for (const s of secs) { const k = `${s.work}.${s.book}.${s.chapter}`; (byChapter.get(k) ?? byChapter.set(k, []).get(k)!).push(s); }
  const out: Chunk[] = [];
  for (const [k, list] of byChapter) {
    let acc: typeof secs = [], tok = 0;
    const flush = () => {
      if (!acc.length) return;
      const a = acc[0], b = acc[acc.length - 1], work = a.work;
      const label = a.n === b.n ? cite(work, a.book, a.chapter, a.n) : `${cite(work, a.book, a.chapter, a.n)}-${b.n}`;
      const body = acc.map((s) => `[${s.n}] ${s.text_pt}`).join(" ");
      const parallel = PARALLELS.filter((p) => p.work === work && p.book === a.book && p.chapter === a.chapter && acc.some((s) => s.n === p.n)).flatMap((p) => p.refs);
      const title = `Flávio Josefo, ${JOS_PT[work]} (Whiston, tradução automática para o português) > ${label}${titles.get(k) ? `: ${titles.get(k)}` : ""}`;
      out.push({ id: `${WORK_IDS[work]}:pt:${a.book}.${a.chapter}.${a.n}`, work_id: WORK_IDS[work], title, text: `${title}\n${body}`, refs: refsOf(body, parallel), tradition: "jewish" });
      acc = []; tok = 0;
    };
    for (const s of list) { const t = approxTokens(s.text); if (acc.length && tok + t > 700) flush(); acc.push(s); tok += t; } // the English text decides the boundaries: same blocks as the English index
    flush();
  }
  return out;
}

async function historianChunks(): Promise<Chunk[]> {
  const rows = (await src("select work, ord, label, title, title_pt, text_pt from hist_units where text_pt is not null and work <> 'caesars' order by work, ord")) as { work: string; ord: number; label: string; title: string; title_pt: string | null; text_pt: string }[];
  const out: Chunk[] = [];
  for (const u of rows) {
    const h = HIST[u.work];
    if (!h) continue;
    const paras = u.text_pt.split(/\n\s*\n/).filter((p) => p.trim());
    let acc: string[] = [], tok = 0, k = 0;
    const flush = () => {
      if (!acc.length) return;
      const body = acc.join("\n\n");
      const title = `${h.author}, ${h.title} (tradução automática para o português) > ${u.label}${u.title_pt || u.title ? `: ${u.title_pt ?? u.title}` : ""}`;
      out.push({ id: `${h.workId}:pt:${u.work}.${u.ord}.${k++}`, work_id: h.workId, title, text: `${title}\n${body}`, refs: refsOf(body), tradition: "general" });
      acc = []; tok = 0;
    };
    for (const p of paras) { const t = approxTokens(p); if (acc.length && tok + t > 600) flush(); acc.push(p); tok += t; }
    flush();
  }
  return out;
}

async function main() {
  const chunks = [...(ONLY === "hist" ? [] : await josephusChunks()), ...(ONLY === "jos" ? [] : await historianChunks())];
  const words = chunks.reduce((t, c) => t + c.text.split(/\s+/).length, 0);
  console.log(`${chunks.length} Portuguese blocks, ${words} words; works: ${[...new Set(chunks.map((c) => c.work_id))].join(", ")}`);
  if (DRY) return;
  const workIds = [...new Set(chunks.map((c) => c.work_id))];
  for (const w of workIds) await dst("insert into library_works (id, enabled) values ($1, true) on conflict (id) do update set enabled = true", [w]);
  await dst("delete from chunks where id like '%:pt:%' and work_id = any ($1::text[])", [`{${workIds.join(",")}}`]);
  const emb = getEmbeddingProvider();
  for (let i = 0; i < chunks.length; i += 24) {
    const part = chunks.slice(i, i + 24);
    const vecs = await emb.embedPassages(part.map((c) => c.text));
    const payload = part.map((c, k) => ({ id: c.id, work_id: c.work_id, text: c.text, language: "pt", title_path: c.title, refs: `{${c.refs.map((r) => `"${r}"`).join(",")}}`, tradition: c.tradition, kind: "history", license: "public_domain", tokens: approxTokens(c.text), embedding: `[${vecs[k].map((x) => x.toFixed(6)).join(",")}]` }));
    await dst(
      `insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
       select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
       from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
       on conflict (id) do update set text=excluded.text, title_path=excluded.title_path, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`,
      [JSON.stringify(payload)],
    );
    if ((i / 24) % 10 === 0) console.log(`${Math.min(i + 24, chunks.length)}/${chunks.length}`);
  }
  console.log(`done: ${chunks.length} blocks stored in shard 2`);
}
main().catch((e) => { console.error(e); process.exit(1); });
