// Uploads the narrations, films and posters (media-out/curiosidades) to the public Supabase Storage bucket "media".
// The service key is read from the Management API at run time and never written anywhere. Usage: node scripts/media/upload-media.mjs [mp3|mp4|jpg ...]
import { readFileSync, readdirSync } from "node:fs";
import { sql } from "../db.mjs";

const REF = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux";
const types = process.argv.slice(2).length ? process.argv.slice(2) : ["mp3", "mp4", "jpg"];
const MIME = { mp3: "audio/mpeg", mp4: "video/mp4", jpg: "image/jpeg" };
await sql("insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do update set public = true");
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys`)).json();
const service = keys.find((k) => k.id === "service_role")?.api_key;
if (!service) throw new Error("no service key");
const base = `https://${REF}.supabase.co/storage/v1/object/media/curiosidades`;
for (const f of readdirSync("media-out/curiosidades").filter((x) => types.includes(x.split(".").pop()))) {
  const body = readFileSync(`media-out/curiosidades/${f}`);
  const r = await fetch(`${base}/${f}`, { method: "POST", headers: { Authorization: `Bearer ${service}`, "Content-Type": MIME[f.split(".").pop()], "x-upsert": "true", "cache-control": "max-age=31536000" }, body });
  console.log(r.status, f, (body.length / 1e6).toFixed(1) + " MB");
  if (!r.ok) console.log((await r.text()).slice(0, 200));
}
