// Library ingestion from Project Gutenberg (public domain), into the Neon library (chunks + embeddings) and the `works`
// record in Supabase (spec 8.10.8): select -> license gate -> download -> normalize -> split -> extract Bible refs ->
// embeddings -> store. Idempotent (chunk ids are <work>:<n>; a work already stored is skipped unless --force).
//
// Selection rule (8.10.9): every contributor (author, translator, editor, illustrator...) must have a KNOWN death year
// <= 1931. That makes the work public domain in Brazil (life + 70) and in the USA (published before 1931) at once, with
// the publication year bounded by the last contributor's death. Anything with an unknown or later death year goes to the
// review report instead of the base.
//
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/library-gutenberg.ts [--limit N] [--budget-chunks N] [--dry] [--ids 1,2,3]
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { approxTokens, splitEntry } from "../../lib/knowledge/chunking";
import { getEmbeddingProvider } from "../../lib/knowledge/embeddings";
import { checkLicense } from "../../lib/knowledge/licenses";
import { sectionsOf, stripGutenberg } from "../../lib/knowledge/book-text";
import { modernizeCitations } from "../../lib/knowledge/old-citations";
import { findReferences } from "../../lib/knowledge/refs-parser";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const MIRROR = process.env.GUTENBERG_MIRROR ?? "https://gutenberg.pglaf.org";
const DIR = "data/raw/gutenberg";
const CATALOG = `${DIR}/pg_catalog.csv`;
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIMIT = Number(arg("--limit") ?? 40);
const BUDGET = Number(arg("--budget-chunks") ?? 60000);
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");
const ONLY = arg("--ids")?.split(",");
const q = (s: string) => s.replace(/'/g, "''");

// ---------- catalog ----------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

interface Entry { id: string; title: string; authors: string; subjects: string; shelves: string }
interface Contributor { name: string; death: number | null; role: string }

export function parseContributors(authors: string): Contributor[] {
  return authors.split(";").map((p) => p.trim()).filter(Boolean).map((part) => {
    const role = /\[([^\]]+)\]\s*$/.exec(part)?.[1] ?? "Author";
    const body = part.replace(/\[[^\]]+\]\s*$/, "").trim();
    const m = /-\s*(\d{3,4})\??\s*(BCE)?\s*$/.exec(body);
    const death = m ? (m[2] ? -Number(m[1]) : Number(m[1])) : /BCE/.test(body) ? -1 : null;
    return { name: body.replace(/,\s*[\d?\s-]+(BCE)?[\d?\s-]*$/, "").trim(), death, role };
  });
}

const SHELVES = ["Category: Religion/Spirituality", "Christianity", "Judaism", "Philosophy", "Category: History - Ancient"];
const WANTED = /Bible|Christ|Church|Theolog|Jesus|Sermon|Prayer|Gospel|Catholic|Jew|Paul|Saint|Doctrine|Faith|Religio|Apostle|Testament|Hymn|Mission|Reformation|Philosoph|Ethics|Ancient|Rome|Greece|Palestine|Israel/i;
const UNWANTED = /Fiction|Poetry|Drama|Juvenile|Humor|Cooking|Short stories|Detective|Love stories|Periodicals|Cookbook|Islam|Mormon|Spiritualism|Theosophy|Occult|Witchcraft|Astrology|Freemason|Bahai|Buddhis|Hindu/i;

// Not taught as sources: non-Trinitarian movements and their founders, hagiography collections, bare Bible text or picture books,
// and anti-Catholic polemic (policy choice, see docs/BIBLIOTECA.md).
const EXCLUDED = /Swedenborg|Eddy, Mary|Christian Science|Science and Health|Mormon|Snow, Eliza|Smith, Joseph|Young, Brigham|Book of Mormon|Doré|Weymouth New Testament|Lives of the Saints|Popish|Nunneries|Jesuit|Romanism|Russell, Charles|Watch Tower|Theosoph/i;

const TRADITIONS: [RegExp, string][] = [
  [/Spurgeon|Gill, John|Bunyan|Strong, Augustus|Carey, William|Judson|Wayland/, "baptist"],
  [/Luther|Melanchthon|Walther|Chemnitz/, "lutheran"],
  [/Calvin|Hodge|Edwards, Jonathan|Warfield|Knox, John|Owen, John|Baxter|Watson, Thomas|Boston, Thomas|Bonar|Murray, Andrew|Kuyper/, "reformed"],
  [/Wesley|Fletcher, John|Clarke, Adam|Watson, Richard|Asbury|Booth|Finney|Simpson, A\. B\./, "wesleyan"],
  [/Aquinas|Newman|Manning|Gibbons|Kempis|Francis, of Assisi|Teresa|Bernard, of Clairvaux|Liguori|Faber|Alphonsus|Sales|Loyola|Bossuet|Fénelon|Fenelon|Pascal|Bellarmine|Chesterton/, "catholic"],
  [/Augustine|Chrysostom|Eusebius|Athanasius|Origen|Tertullian|Irenaeus|Jerome|Ambrose|Basil|Gregory|Cyprian|Clement of|Justin|Ignatius, Saint|Polycarp|Lactantius|Cyril|Hilary/, "patristic"],
  [/Darby|Scofield|Mackintosh|Kelly, William|Newton, B|Bellett|Trotter|Gaebelein|Pember|Grant, F/, "dispensational"],
  [/Menno|Hubmaier|Sattler/, "anabaptist"],
  [/Philo|Josephus|Edersheim|Maimonides|Hillel|Mishnah|Talmud|Jewish/, "jewish"],
  [/Wigglesworth|Seymour|Parham|Durham|Apostolic Faith/, "pentecostal"],
];

function classify(e: Entry): { kind: string; tradition: string } {
  const t = `${e.title} ${e.subjects}`;
  let kind = "theology";
  if (/Commentar|Expositor|Expositions|Exposition of|Notes on the|Notes on|Lectures on|Homilies/i.test(t)) kind = "commentary";
  else if (/Dictionary|Cyclop|Concordance/i.test(t)) kind = "dictionary";
  else if (/Encyclop/i.test(t)) kind = "encyclopedia";
  else if (/Philosoph|Ethics|Metaphysic|Republic|Dialogue/i.test(t) && !/Christ|Bible|Church/i.test(e.subjects)) kind = "philosophy";
  else if (/History|Antiquit|Archaeolog|Palestine|Rome|Greece|Egypt|Babylon|Assyria|Josephus/i.test(t) && !/Sermon|Theolog/i.test(e.subjects)) kind = /Archaeolog|Excavat|Explor/i.test(t) ? "archaeology" : "history";
  const tradition = TRADITIONS.find(([re]) => re.test(e.authors))?.[1] ?? "general";
  return { kind, tradition };
}

// ---------- text ----------
async function download(id: string): Promise<string | null> {
  mkdirSync(DIR, { recursive: true });
  const path = `${DIR}/${id}.txt`;
  if (existsSync(path)) return readFileSync(path, "utf8");
  for (const url of [`${MIRROR}/cache/epub/${id}/pg${id}.txt`, `${MIRROR}/files/${id}/${id}-0.txt`, `${MIRROR}/files/${id}/${id}.txt`]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const t = await res.text();
      writeFileSync(path, t);
      return t;
    } catch { /* next */ }
  }
  return null;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  if (!existsSync(CATALOG)) writeFileSync(CATALOG, Buffer.from(await (await fetch(`${MIRROR}/cache/epub/feeds/pg_catalog.csv`)).arrayBuffer()));
  const cat = parseCsv(readFileSync(CATALOG, "utf8")).filter((r) => r.Type === "Text" && r.Language === "en");
  const all: Entry[] = cat.map((r) => ({ id: r["Text#"], title: r.Title.replace(/\s+/g, " "), authors: r.Authors, subjects: r.Subjects, shelves: r.Bookshelves }));

  const eligible: (Entry & { maxDeath: number; kind: string; tradition: string })[] = [];
  const review: string[] = [];
  for (const e of all) {
    if (ONLY && !ONLY.includes(e.id)) continue;
    if (!ONLY && (EXCLUDED.test(`${e.title} ${e.authors}`) || !SHELVES.some((s) => e.shelves.includes(s)) || !WANTED.test(`${e.subjects} ${e.title}`) || UNWANTED.test(e.subjects))) continue;
    const people = parseContributors(e.authors);
    if (!people.length) continue;
    const deaths = people.map((p) => p.death);
    const known = deaths.every((d): d is number => d !== null);
    const maxDeath = known ? Math.max(...(deaths as number[])) : NaN;
    const gate = known ? checkLicense({ license: "public_domain", pub_year: maxDeath, author_death_years: deaths as number[] }, 2026) : { ok: false, reason: "contributor with unknown death year: manual review" };
    if (!gate.ok || maxDeath > 1930) { review.push(`${e.id}\t${e.title.slice(0, 70)}\t${e.authors.slice(0, 60)}\t${gate.reason}`); continue; }
    const cls = classify(e);
    if (cls.kind === "philosophy" && !/Plato|Aristotle|Boethius|Pascal|Augustine|Epictetus|Marcus Aurelius|Plotinus|Stoic|Socrat|Cicero|Seneca|Plutarch|Philo\b|religio|God|soul|ethic|Kempis|Anselm|Aquinas/i.test(`${e.title} ${e.authors} ${e.subjects}`)) continue;
    eligible.push({ ...e, maxDeath, ...cls });
  }
  // Breadth first: interleave commentary, history, theology (tradition-labelled works first) and philosophy.
  const byKind = (ks: string[], tradFirst = false) =>
    eligible.filter((e) => ks.includes(e.kind)).sort((a, b) => (tradFirst ? Number(a.tradition === "general") - Number(b.tradition === "general") : 0) || Number(a.id) - Number(b.id));
  const lanes = [byKind(["commentary"]), byKind(["history", "archaeology"]), byKind(["theology", "dictionary", "encyclopedia"], true), byKind(["philosophy"])];
  const pattern = [0, 0, 0, 0, 1, 1, 2, 2, 2, 3];
  const ordered: typeof eligible = [];
  for (let i = 0; ordered.length < eligible.length; i++) {
    const lane = lanes[pattern[i % pattern.length]];
    const next = lane.shift() ?? lanes.find((l) => l.length)?.shift();
    if (!next) break;
    ordered.push(next);
  }
  eligible.length = 0;
  eligible.push(...ordered);
  writeFileSync(`${DIR}/review-queue.tsv`, review.join("\n"));
  console.log(`eligible: ${eligible.length}; sent to the license review queue: ${review.length} (data/raw/gutenberg/review-queue.tsv)`);
  if (DRY) {
    for (const e of eligible.slice(0, LIMIT)) console.log(`${e.id}\t${e.kind}\t${e.tradition}\t${e.title.slice(0, 60)}\t${e.authors.slice(0, 40)}`);
    return;
  }

  const done = new Set<string>((await nsql("select distinct work_id from chunks")).map((r: Record<string, unknown>) => String(r.work_id)));
  const emb = getEmbeddingProvider();
  let storedChunks = Number((await nsql("select count(*)::int n from chunks"))[0].n);
  let worksDone = 0;
  for (const e of eligible) {
    if (worksDone >= LIMIT || storedChunks >= BUDGET) break;
    const workId = `pg_${e.id}`;
    if (!FORCE && done.has(workId)) continue;
    const T0 = Date.now();
    const raw = await download(e.id);
    if (!raw) { console.log(`skip ${e.id}: download failed`); continue; }
    const text = stripGutenberg(raw);
    const secs = sectionsOf(text);
    const shortTitle = e.title.slice(0, 80);
    const chunks: { id: string; title: string; text: string; refs: string[] }[] = [];
    let n = 0;
    for (const s of secs) {
      for (const block of splitEntry(`${shortTitle} > ${s.heading || "Texto"}`, s.body)) {
        const refs = [...new Set(findReferences(modernizeCitations(block), { strictCase: true }).filter((r) => !r.invalid).flatMap((r) => r.refs))].slice(0, 40);
        chunks.push({ id: `${workId}:${n++}`, title: `${shortTitle} > ${s.heading || "Texto"}`, text: block, refs });
      }
    }
    if (chunks.length < 3) { console.log(`skip ${e.id}: too little text (${chunks.length} chunks)`); continue; }
    if (chunks.length > 800) chunks.length = 800; // keep a single huge work from eating the whole space

    const tSplit = Date.now() - T0;
    const credit = `Texto de domínio público (autores e tradutores falecidos até ${e.maxDeath}). Fonte: Project Gutenberg, ebook nº ${e.id} (https://www.gutenberg.org/ebooks/${e.id}); texto-base de ${e.authors.split(";")[0].replace(/\s*\[.*$/, "")}.`;
    const people = parseContributors(e.authors);
    const years = `ARRAY[${people.map((p) => p.death ?? 0).join(",")}]::int[]`;
    await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
      values ('${workId}','${q(e.title.slice(0, 200))}',ARRAY[${people.map((p) => `'${q(p.name)}'`).join(",")}]::text[],'{}',${years},${e.maxDeath},'en','${e.kind}','${e.tradition}','public_domain','${q(credit)}','https://www.gutenberg.org/ebooks/${e.id}',now(),'${createHash("sha256").update(raw).digest("hex")}',true,'approved')
      on conflict (id) do update set credit_text=excluded.credit_text, kind=excluded.kind, tradition=excluded.tradition, collected_at=now()`);
    await nsql("insert into library_works (id, enabled) values ($1, true) on conflict (id) do nothing", [workId]);

    const tMeta = Date.now() - T0;
    const B = 24;
    for (let i = 0; i < chunks.length; i += B) {
      const part = chunks.slice(i, i + B);
      const vecs = await emb.embedPassages(part.map((c) => c.text));
      const payload = part.map((c, k) => ({
        id: c.id, work_id: workId, text: c.text, language: "en", title_path: c.title, refs: `{${c.refs.map((r) => `"${r}"`).join(",")}}`,
        tradition: e.tradition, kind: e.kind, license: "public_domain", tokens: approxTokens(c.text), embedding: `[${vecs[k].map((x) => x.toFixed(5)).join(",")}]`,
      }));
      await nsql(
        `insert into chunks (id,work_id,text,language,title_path,refs,tradition,kind,license,tokens,embedding)
         select id,work_id,text,language,title_path,refs::text[],tradition,kind,license,tokens,embedding::vector
         from jsonb_to_recordset($1::jsonb) as t(id text,work_id text,text text,language text,title_path text,refs text,tradition text,kind text,license text,tokens int,embedding text)
         on conflict (id) do update set text=excluded.text, refs=excluded.refs, embedding=excluded.embedding, tokens=excluded.tokens`,
        [JSON.stringify(payload)],
      );
    }
    storedChunks += chunks.length;
    worksDone++;
    appendFileSync(`${DIR}/ingested.tsv`, `${workId}\t${e.kind}\t${e.tradition}\t${chunks.length}\t${e.title.slice(0, 80)}\t${e.authors.slice(0, 50)}\n`);
    console.log(`OK ${workId} [${e.kind}/${e.tradition}] ${chunks.length} chunks :: ${e.title.slice(0, 60)}  (total ${storedChunks}; split ${tSplit} ms, meta ${tMeta - tSplit} ms, embed+store ${Date.now() - T0 - tMeta} ms)`);
  }
  const [{ s }] = await nsql("select pg_size_pretty(pg_database_size(current_database())) s");
  console.log(`done: ${worksDone} works this run; chunks in the library: ${storedChunks}; Neon size ${s}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
