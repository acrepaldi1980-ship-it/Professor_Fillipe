// Knowledge graph from the Theographic Bible Metadata (CC BY-SA 4.0; it already merges OpenBible Geocoding and Pleiades
// coordinates) -> Neon kg_entities / kg_relations (spec 8.10.7). Idempotent.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/graph-theographic.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { checkLicense } from "../../lib/knowledge/licenses";
import { parseReference } from "../../lib/knowledge/refs-parser";
import { NAME_EN } from "../../lib/teacher/grounding";
import { sql } from "../db.mjs";
import { nsql } from "../neon.mjs";

const BASE = "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json";
const DIR = process.env.KG_DIR ?? "data/raw/theographic";
const CREDIT =
  "Theographic Bible Metadata (Robert Rouse e colaboradores), CC BY-SA 4.0, que reúne dados do OpenBible Geocoding (CC BY 4.0) e do Pleiades (CC BY): https://github.com/robertrouse/theographic-bible-metadata";
const q = (s: string) => s.replace(/'/g, "''");
const lit = (s: string | null | undefined) => (s ? `'${q(s)}'` : "null");
const arr = (a: string[]) => `ARRAY[${a.map((x) => `'${q(x)}'`).join(",")}]::text[]`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = { id: string; fields: Record<string, any> };
async function load(name: string): Promise<Rec[]> {
  mkdirSync(DIR, { recursive: true });
  const path = `${DIR}/${name}.json`;
  if (!existsSync(path)) writeFileSync(path, Buffer.from(await (await fetch(`${BASE}/${name}.json`)).arrayBuffer()));
  return JSON.parse(readFileSync(path, "utf8")) as Rec[];
}

const PT_OF = new Map<string, string>(Object.entries(NAME_EN).map(([pt, en]) => [en, pt.charAt(0).toUpperCase() + pt.slice(1)]));
const stripMd = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();

async function main() {
  const gate = checkLicense({ license: "cc_by_sa" });
  if (!gate.ok) throw new Error(gate.reason);
  await sql(`insert into works (id,title,authors,translators,author_death_years,pub_year,language,kind,tradition,license,credit_text,source_url,collected_at,file_hash,enabled,review_status)
    values ('theographic_kg','Grafo bíblico: pessoas, lugares e eventos (Theographic)',ARRAY['Robert Rouse e colaboradores']::text[],'{}','{}',2026,'en','geodata','general','cc_by_sa','${q(CREDIT)}','https://github.com/robertrouse/theographic-bible-metadata',now(),null,true,'approved')
    on conflict (id) do update set credit_text=excluded.credit_text, collected_at=now()`);

  const [verses, people, places, events, groups] = await Promise.all([load("verses"), load("people"), load("places"), load("events"), load("peopleGroups")]);
  const osis = new Map<string, string>();
  for (const v of verses) {
    const ref = v.fields.osisRef && parseReference(String(v.fields.osisRef).replace(/\./g, " ").replace(/^(\S+) (\d+) (\d+)$/, "$1 $2:$3"))?.[0];
    if (ref) osis.set(v.id, ref);
  }
  const refsOf = (ids: string[] | undefined) => [...new Set((ids ?? []).map((i) => osis.get(i)).filter((x): x is string => !!x))].slice(0, 60);
  const idOf = new Map<string, string>(); // airtable record id -> entity id

  type Ent = { id: string; kind: string; en: string; pt: string | null; aliases: string[]; desc: string | null; period: string | null; refs: string[]; coords?: [number, number]; src: Record<string, string> };
  const ents: Ent[] = [];
  for (const p of people) {
    const f = p.fields;
    const id = `person:${f.slug ?? f.personLookup}`;
    idOf.set(p.id, id);
    const en = String(f.displayTitle ?? f.name ?? "").trim();
    if (!en) continue;
    const years = [f.birthYear, f.deathYear].filter((x: unknown) => x !== undefined && x !== "").join(" a ");
    ents.push({ id, kind: "person", en, pt: PT_OF.get(en.toLowerCase()) ?? null, aliases: [...new Set([f.name, f.displayTitle].filter(Boolean).map(String))], desc: f.dictionaryText ? stripMd(String(f.dictionaryText)).slice(0, 400) : null, period: years || null, refs: refsOf(f.verses), src: { theographic: String(f.personLookup ?? ""), ...(f.eastons ? { easton: String(f.dictionaryLink ?? "") } : {}) } });
  }
  for (const p of places) {
    const f = p.fields;
    const id = `place:${f.slug ?? f.placeLookup}`;
    idOf.set(p.id, id);
    const en = String(f.displayTitle ?? f.kjvName ?? "").trim();
    if (!en) continue;
    const lat = Number(f.openBibleLat ?? f.pleiadesLat ?? f.recogitoLat ?? f.latitude);
    const lon = Number(f.openBibleLong ?? f.pleiadesLon ?? f.recogitoLon ?? f.longitude);
    const src: Record<string, string> = { theographic: String(f.placeLookup ?? "") };
    if (f.openBibleUri) src.openbible = String(f.openBibleUri);
    if (f.pleiadesUri) src.pleiades = String(f.pleiadesUri);
    ents.push({ id, kind: "place", en, pt: null, aliases: [...new Set([f.displayTitle, f.kjvName, f.esvName].filter(Boolean).map(String))], desc: f.comment ? String(f.comment).slice(0, 300) : f.featureType ? String(f.featureType) : null, period: null, refs: refsOf(f.verses), coords: Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : undefined, src });
  }
  for (const e of events) {
    const f = e.fields;
    const id = `event:${f.eventID}`;
    idOf.set(e.id, id);
    if (!f.title) continue;
    ents.push({ id, kind: "event", en: String(f.title), pt: null, aliases: [], desc: f.duration ? `Duração: ${f.duration}` : null, period: f.startDate ? String(f.startDate) : null, refs: refsOf(f.verses), src: { theographic: String(f.eventID) } });
  }
  for (const g of groups) {
    const id = `group:${String(g.fields.groupName).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    idOf.set(g.id, id);
    ents.push({ id, kind: "group", en: String(g.fields.groupName), pt: null, aliases: [], desc: null, period: null, refs: [], src: {} });
  }

  const dedup = new Map(ents.map((e) => [e.id, e]));
  const all = [...dedup.values()];
  for (let i = 0; i < all.length; i += 200) {
    const part = all.slice(i, i + 200).map((e) => `('${q(e.id)}','${e.kind}',${lit(e.pt)},'${q(e.en)}',${arr(e.aliases)},${lit(e.desc)},${lit(e.period)},${arr(e.refs)},${e.coords ? `'(${e.coords[0]},${e.coords[1]})'::point` : "null"},'${q(JSON.stringify(e.src))}'::jsonb)`).join(",");
    await nsql(`insert into kg_entities (id,kind,name_pt,name_en,aliases,description,period,refs,place_coords,source_ids) values ${part}
      on conflict (id) do update set name_pt=excluded.name_pt, aliases=excluded.aliases, description=excluded.description, period=excluded.period, refs=excluded.refs, place_coords=excluded.place_coords, source_ids=excluded.source_ids, updated_at=now()`);
  }
  console.log("entities:", all.length);

  const rels = new Set<string>();
  const add = (a: string | undefined, b: string | undefined, r: string) => {
    if (a && b && a !== b && dedup.has(a) && dedup.has(b)) rels.add(`${a}|${b}|${r}`);
  };
  for (const p of people) {
    const f = p.fields;
    const me = idOf.get(p.id);
    for (const x of f.birthPlace ?? []) add(me, idOf.get(x), "born_in");
    for (const x of f.deathPlace ?? []) add(me, idOf.get(x), "died_in");
    for (const x of f.memberOf ?? []) add(me, idOf.get(x), "member_of");
    for (const x of f.father ?? []) add(idOf.get(x), me, "parent_of");
    for (const x of f.mother ?? []) add(idOf.get(x), me, "parent_of");
    for (const x of f.partners ?? []) add(me, idOf.get(x), "spouse_of");
    for (const x of f.siblings ?? []) add(me, idOf.get(x), "sibling_of");
  }
  for (const e of events) for (const x of e.fields.participants ?? []) add(idOf.get(x), idOf.get(e.id), "participated_in");
  const list = [...rels];
  for (let i = 0; i < list.length; i += 1500) {
    const part = list.slice(i, i + 1500).map((r) => { const [a, b, t] = r.split("|"); return `('${q(a)}','${q(b)}','${t}')`; }).join(",");
    await nsql(`insert into kg_relations (from_id,to_id,relation) values ${part} on conflict do nothing`);
  }
  console.log("relations:", list.length);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
