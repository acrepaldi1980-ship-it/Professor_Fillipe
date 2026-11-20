// Loads the map routes into map_routes (Supabase) and checks every step against the geocoded places of the knowledge graph
// (Theographic/OpenBible): a step more than 1.5 degrees from any place with a similar name is reported. Idempotent.
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/seed-routes.mts
import { ROUTES } from "../lib/visuals/route-data";
import { sql } from "./db.mjs";
import { nsql } from "./neon.mjs";

const q = (s: string) => s.replace(/'/g, "''");
const places = await nsql("select name_pt, name_en, place_coords[1] lat, place_coords[0] lon from kg_entities where kind='place' and place_coords is not null");
const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180));
let checked = 0, flagged = 0;
for (const r of ROUTES) {
  for (const st of r.steps) {
    const base = st.name.replace(/\s*\(.*\)/, "").toLowerCase();
    const near = places.filter((p: { name_pt?: string; name_en: string }) => [p.name_pt, p.name_en].some((n) => n && (n.toLowerCase() === base || base.includes(n.toLowerCase()) || n.toLowerCase().includes(base))));
    if (!near.length) continue;
    checked++;
    const best = Math.min(...near.map((p: { lat: number; lon: number }) => dist(st, p)));
    if (best > 1.5) { flagged++; console.log(`CHECK ${r.id}/${st.id} ${st.name}: ${best.toFixed(2)} deg from the nearest homonym`); }
  }
  await sql(`insert into map_routes (id, name, era, steps, sources) values ('${r.id}','${q(r.name)}','${r.era}','${q(JSON.stringify({ text: r.text, steps: r.steps }))}'::jsonb, ARRAY['OpenBible.info Geocoding (CC BY 4.0)','Theographic Bible Metadata (CC BY-SA 4.0)','Natural Earth (domínio público)']) on conflict (id) do update set name=excluded.name, era=excluded.era, steps=excluded.steps, sources=excluded.sources, updated_at=now()`);
}
console.log(`${ROUTES.length} routes loaded; ${checked} steps matched a known place, ${flagged} flagged`);
