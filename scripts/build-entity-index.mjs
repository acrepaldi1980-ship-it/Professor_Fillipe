// Builds lib/knowledge/entity-index.json: the people, places and events of the Bible with their English and PORTUGUESE names and their verses, so the search
// can recognise "Zaqueu", "Moisés" or "Monte Carmelo" in a question (the knowledge graph only had Portuguese names for 78 of 4,300 entities).
// The Portuguese names are learned from the Bibles themselves: for each entity, the capitalised word(s) that appear in the Portuguese verses where the graph says the
// entity is mentioned (and rarely elsewhere) are its Portuguese name. Three Portuguese versions are read, so variants (Tiago/Jacó, Davi/David) are kept.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/build-entity-index.mjs
import { writeFileSync } from "node:fs";
import { sql } from "./db.mjs";
import { nsql } from "./neon.mjs";

const VERSIONS = ["por_blivre_2018", "por_mundial", "por_nbv_open"];
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const CAP = /\p{Lu}[\p{L}'’]+(?:\s+(?:de|da|do|dos|das)\s+\p{Lu}[\p{L}'’]+|\s+\p{Lu}[\p{L}'’]+)*/gu;
const STOP = new Set(["e", "o", "a", "os", "as", "um", "uma", "que", "se", "mas", "pois", "porque", "quando", "entao", "ele", "ela", "eles", "elas", "eu", "tu", "vos", "nos", "meu", "teu", "seu", "senhor", "deus", "assim", "porem", "disse", "ora", "tambem", "portanto", "eis", "este", "esta", "isto", "aquele", "naquele", "no", "na", "em", "de", "do", "da", "dos", "das", "ao", "aos", "por", "para", "com", "sem", "sobre", "como", "onde", "todo", "toda", "todos", "ate", "depois", "antes", "ouve", "vi", "vinde", "bem", "ai"]);

function sim(a, b) {
  a = norm(a).replace(/[^a-z]/g, ""); b = norm(b).replace(/[^a-z]/g, "");
  if (!a || !b) return 0;
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

async function loadVerses(v) {
  const map = new Map(); const df = new Map(); let N = 0;
  for (let from = 0; ; from += 5000) {
    const rows = await sql(`select ref, text from bible_verses where version_id='${v}' order by ref limit 5000 offset ${from}`);
    if (!rows.length) break;
    for (const r of rows) {
      const grams = new Set();
      for (const m of r.text.matchAll(CAP)) {
        const run = m[0];
        const words = run.split(/\s+/);
        grams.add(run);
        for (const w of words) if (w.length >= 3 && !["de", "da", "do", "dos", "das"].includes(w)) grams.add(w);
      }
      map.set(r.ref, [...grams]);
      for (const g of grams) df.set(g, (df.get(g) ?? 0) + 1);
      N++;
    }
  }
  return { map, df, N };
}

const ents = await nsql("select id, kind, name_pt, name_en, aliases, refs from kg_entities where kind in ('person','place','event')");
console.log("entities", ents.length);
const bibles = [];
for (const v of VERSIONS) { bibles.push(await loadVerses(v)); console.log(v, "verses", bibles.at(-1).N); }

const out = [];
for (const e of ents) {
  const en = e.name_en ?? ""; if (!en) continue;
  const refs = (e.refs ?? []).filter((r) => /^[0-9A-Z]{3}\.\d+\.\d+$/.test(r));
  const pt = new Set(e.name_pt ? [e.name_pt] : []);
  if (e.kind !== "event" && refs.length) {
    const sample = refs.slice(0, 40);
    for (const b of bibles) {
      const count = new Map();
      for (const r of sample) for (const g of b.map.get(r) ?? []) count.set(g, (count.get(g) ?? 0) + 1);
      const cands = [];
      for (const [g, c] of count) {
        const support = c / sample.length;
        const lift = support / ((b.df.get(g) ?? 1) / b.N);
        const first = norm(g).split(/\s+/)[0];
        if (STOP.has(first) || g.length < 3) continue;
        const s = Math.max(sim(g, en), sim(g.split(/\s+/)[0], en.split(/\s+/)[0]));
        const ok = (support >= 0.34 && lift >= 25) || (s >= 0.55 && support >= 0.2 && lift >= 8) || (s >= 0.7 && support >= 0.15 && lift >= 4);
        if (ok) cands.push({ g, s, support, score: support * Math.log(lift + 1) + s });
      }
      cands.sort((x, y) => y.score - x.score);
      // names that look like the English one (Zaqueu/Zacchaeus): up to 2 (accent variants collapse); names that do not (Tiago/James): only the best one, and only when it is clearly the subject
      const like = cands.filter((c) => c.s >= 0.5);
      const seen = new Set();
      for (const c of like) { const k = norm(c.g); if (seen.has(k)) continue; seen.add(k); if (seen.size <= 2) pt.add(c.g); }
      if (!like.length && cands[0] && cands[0].support >= 0.5) pt.add(cands[0].g);
    }
  }
  out.push({ id: e.id, k: e.kind[0], en, al: (e.aliases ?? []).filter((a) => a && a !== en).slice(0, 6), pt: [...pt].slice(0, 6), r: refs.slice(0, 40) });
}
writeFileSync("lib/knowledge/entity-index.json", JSON.stringify(out));
const withPt = out.filter((x) => x.pt.length).length;
console.log(`wrote ${out.length} entities; with Portuguese names: ${withPt}`);
for (const n of ["Zacchaeus", "Moses", "Peter", "David", "Abraham", "Solomon", "Barnabas", "Stephen", "Lazarus", "Jerusalem", "Bethlehem", "Mount Carmel", "James", "Jonah"]) console.log(n, JSON.stringify(out.filter((x) => x.en === n || x.en.startsWith(n + " ")).slice(0, 3).map((x) => [x.id, x.pt, x.r.length])));
