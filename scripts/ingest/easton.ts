// Easton's Bible Dictionary (1897, public domain) via the Theographic dataset (CC BY-SA 4.0).
// Usage: tsx scripts/ingest/easton.ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { splitEntry, approxTokens } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { expandRefs, findReferences } from "../../lib/knowledge/refs-parser";
import { checkLicense } from "../../lib/knowledge/licenses";
import { sql } from "../db.mjs";

const URL = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json/easton.json";
const WORK_ID = "easton_1897";
const CREDIT =
  "Easton's Bible Dictionary (M. G. Easton, 1897, domínio público), na compilação do conjunto Theographic Bible Metadata (Robert Rouse e colaboradores), licença CC BY-SA 4.0: https://github.com/robertrouse/theographic-bible-metadata";

interface Entry {
  fields: { termLabel: string; dictText: string; termID: string; itemNum: number };
}

const q = (s: string) => s.replace(/'/g, "''");

async function main() {
  mkdirSync("data/raw", { recursive: true });
  const path = "data/raw/easton.json";
  if (!existsSync(path)) writeFileSync(path, Buffer.from(await (await fetch(URL)).arrayBuffer()));
  const buf = readFileSync(path);
  const hash = createHash("sha256").update(buf).digest("hex");
  const entries = JSON.parse(buf.toString("utf8")) as Entry[];

  // Group by term, keep original order.
  const terms = new Map<string, { label: string; texts: string[] }>();
  for (const e of entries.sort((a, b) => a.fields.itemNum - b.fields.itemNum)) {
    const f = e.fields;
    if (!f.dictText) continue;
    const t = terms.get(f.termID) ?? { label: f.termLabel, texts: [] };
    t.texts.push(f.dictText);
    terms.set(f.termID, t);
  }

  const gate = checkLicense({ license: "cc_by_sa" });
  if (!gate.ok) throw new Error(gate.reason);

  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('${WORK_ID}','Easton''s Bible Dictionary',ARRAY['Matthew George Easton']::text[],'{}',ARRAY[1894]::int[],1897,'en','dictionary','general','cc_by_sa','${q(CREDIT)}','${URL}',now(),'${hash}',false,'pending')
    on conflict (id) do update set credit_text=excluded.credit_text, file_hash=excluded.file_hash, collected_at=now()`);

  const rows: { id: string; work_id: string; text: string; language: string; title_path: string; refs: string[]; tradition: string; kind: string; license: string; tokens: number }[] = [];
  let n = 0;
  for (const [, t] of terms) {
    const body = t.texts
      .join(" ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links -> label
      .replace(/\s+/g, " ")
      .trim();
    for (const text of splitEntry(t.label, body)) {
      const refs = expandRefs(findReferences(text).flatMap((r) => r.refs)).slice(0, 400);
      rows.push({ id: `${WORK_ID}:${n++}`, work_id: WORK_ID, text, language: "en", title_path: t.label, refs, tradition: "general", kind: "dictionary", license: "cc_by_sa", tokens: approxTokens(text) });
    }
  }
  console.log(`terms=${terms.size} chunks=${rows.length}`);

  const emb = getEmbeddingProvider();
  const B = 100;
  for (let i = 0; i < rows.length; i += B) {
    const part = rows.slice(i, i + B);
    const vecs = await emb.embedPassages(part.map((r) => r.text));
    const payload = part.map((r, k) => ({
      ...r,
      refs: `{${r.refs.map((x) => `"${x}"`).join(",")}}`,
      embedding: `[${vecs[k].map((x) => x.toFixed(6)).join(",")}]`,
    }));
    await sql(`insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
      select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector from jsonb_to_recordset($j$${JSON.stringify(payload)}$j$::jsonb)
      as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
      on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`);
    if ((i / B) % 5 === 0) console.log(`  ${Math.min(i + B, rows.length)}/${rows.length}`);
  }
  await sql(`update works set enabled=true, review_status='approved' where id='${WORK_ID}'`);
  console.log(`OK easton: ${rows.length} chunks`);

  const lic = readFileSync("docs/LICENSES.md", "utf8");
  if (!lic.includes(`## ${WORK_ID} `)) {
    appendFileSync(
      "docs/LICENSES.md",
      `\n## ${WORK_ID} — Easton's Bible Dictionary\n- Autor(es) / tradutor(es) e anos de morte: Matthew George Easton (1894)\n- Edição e ano de publicação: 3ª edição, 1897\n- Licença: cc_by_sa. O texto original é de domínio público; a compilação usada (Theographic) é CC BY-SA 4.0, que adotamos por precaução.\n- Crédito exigido (texto exato): ${CREDIT}\n- Fonte (URL): ${URL}\n- Data da coleta: ${new Date().toISOString().slice(0, 10)}\n- Hash SHA-256 do arquivo: ${hash}\n- Observações: CC BY-SA: manter separada e não misturar com texto próprio do app. Links de versículos do original foram reduzidos ao rótulo e as referências extraídas para chunks.refs.\n`,
    );
  }
}
main();
