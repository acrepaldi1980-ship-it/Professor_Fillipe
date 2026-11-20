// Downloads the free reference images (Wikimedia Commons: public domain, CC0 or CC BY) used to guide realistic illustrations.
// One API call for the metadata, then one download per image, slowly and with backoff (Commons rate-limits). Writes the images to
// lib/visuals/refs/ (resized to <=1024 px, jpeg) and refs.json with title, author, license and source URL for the credits.
// Usage: NODE_OPTIONS=--use-env-proxy node scripts/fetch-refs.mjs
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const UA = "ProfessorFilipeApp/1.0 (bible study app; reference images for illustrations)";
const DIR = "lib/visuals/refs";
// tag -> Commons file title. Only PD, CC0 and CC BY (no share-alike) files.
const FILES = {
  galilee_sunrise: "File:Israel Sunrise and ship, Sea of Galilee (15602213684).jpg",
  judean_desert: "File:Judean Desert (997008136906705171).jpg",
  ark_engraving: "File:Ark of the Covenant engraving.jpg",
  ark_tissot: "File:Tissot Drawing 143 The ark of the covenant (Exodus 25 10) for Brunoff 136 L'Arche.jpg",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) { await sleep(20000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 90)}`);
    return res;
  }
  throw new Error("rate limited: " + url.slice(0, 90));
}
mkdirSync(DIR, { recursive: true });
const titles = Object.values(FILES).join("|");
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1024&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription&titles=${encodeURIComponent(titles)}`;
const meta = await (await get(api)).json();
const byTitle = new Map(Object.values(meta.query.pages).map((p) => [p.title, p]));
const out = [];
for (const [tag, title] of Object.entries(FILES)) {
  const p = byTitle.get(title.replace(/_/g, " "));
  const ii = p?.imageinfo?.[0];
  if (!ii) { console.log("MISSING", title); continue; }
  const lic = ii.extmetadata?.LicenseShortName?.value ?? "?";
  if (!/^(Public|CC0|CC BY \d)/.test(lic) || /SA|NC|ND/.test(lic)) { console.log("SKIP license", lic, title); continue; }
  const file = `${DIR}/${tag}.jpg`;
  if (!existsSync(file)) {
    await sleep(8000);
    const buf = Buffer.from(await (await get(ii.thumburl ?? ii.url)).arrayBuffer());
    await sharp(buf).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(file);
  }
  out.push({ tag, file: `${tag}.jpg`, title: title.replace(/^File:/, ""), license: lic, author: (ii.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 120), source: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}` });
  console.log("OK", tag, lic);
}
writeFileSync(`${DIR}/refs.json`, JSON.stringify(out, null, 1));
console.log(out.length, "references");
