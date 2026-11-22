// Checks that every passage cited by the curated lives exists in the Bible database (first and last verse of each range), RA-09.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/check-characters.mts
import { CURATED } from "../lib/characters/index.ts";
import { sql } from "../scripts/db.mjs";
const ends = (ref: string) => { const [a, b] = ref.split("-"); const p = (r: string) => r.split("."); const [bk, c1, v1] = p(a); const e = b ? p(b) : null; return { bk, c1, v1: v1 ?? "1", c2: e ? (e[1] ?? c1) : c1, v2: e ? (e[2] ?? "") : (v1 ?? "") }; };
const items: { w: string; need: string[] }[] = [];
for (const c of CURATED) {
  const refs = [...c.chapters.map((x) => ({ w: `${c.id}/${x.id}`, r: x.ref })), ...c.lessons.map((l) => ({ w: `${c.id}/lesson ${l.ref}`, r: l.ref })), ...(c.born.ref ? [{ w: `${c.id}/born`, r: c.born.ref }] : []), ...(c.died.ref ? [{ w: `${c.id}/died`, r: c.died.ref }] : [])];
  for (const { w, r } of refs) { const e = ends(r); const need = [`${e.bk}.${e.c1}.${e.v1}`]; if (e.v2) need.push(`${e.bk}.${e.c2}.${e.v2}`); items.push({ w: `${w} ${r}`, need }); }
}
const all = [...new Set(items.flatMap((i) => i.need))];
const run = async <T,>(q: string): Promise<T> => { for (let i = 0; i < 8; i++) { try { return (await sql(q)) as T; } catch (e) { if (!String(e).includes("429")) throw e; await new Promise((r) => setTimeout(r, 15000)); } } throw new Error("throttled"); };
const rows = (await run<{ ref: string }[]>(`select ref from bible_verses where version_id='por_blivre_2018' and ref = any(array[${all.map((r) => `'${r}'`).join(",")}])`));
const have = new Set(rows.map((r) => r.ref)); let bad = 0;
for (const i of items) { const miss = i.need.filter((r) => !have.has(r)); if (miss.length) { bad++; console.log("MISSING", i.w, miss.join(",")); } }
console.log(`checked ${items.length} references, ${bad} with a missing verse`);
process.exit(0);
