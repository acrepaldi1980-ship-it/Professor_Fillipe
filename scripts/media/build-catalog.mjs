// Builds lib/curiosities/catalog.json from the scripts, the narration timelines and the archaeology credits.
// Usage: node scripts/media/build-catalog.mjs   (run after render-narration.mjs)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CURIOSITIES } from "./curiosities-data.mjs";

const arch = existsSync("lib/archaeology/items.json") ? JSON.parse(readFileSync("lib/archaeology/items.json", "utf8")) : [];
const byId = Object.fromEntries(arch.map((a) => [a.id, a]));
const out = [];
for (const c of CURIOSITIES) {
  const tl = existsSync(`media-out/curiosidades/${c.id}.json`) ? JSON.parse(readFileSync(`media-out/curiosidades/${c.id}.json`, "utf8")) : null;
  if (!tl) { console.log("no narration yet:", c.id); continue; }
  const images = [...new Set(c.images)].map((id) => byId[id]).filter((a) => a?.image).map((a) => ({ id: a.id, image: a.image, name: a.name, credit: a.credit }));
  out.push({ id: c.id, title: c.title, refs: c.refs, sources: c.sources, duration: tl.duration, sentences: tl.sentences, images, hasVideo: existsSync(`media-out/curiosidades/${c.id}.mp4`) });
}
writeFileSync("lib/curiosities/catalog.json", JSON.stringify(out, null, 1));
console.log(`${out.length} curiosities in the catalog (${out.filter((x) => x.hasVideo).length} with film)`);
