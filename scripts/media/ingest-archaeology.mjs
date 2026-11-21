// Builds the archaeology gallery from photos saved by hand in public/arqueologia/<id>.(jpg|jpeg|png|webp): resizes each to 1100 px (JPEG) and writes
// lib/archaeology/items.json with the texts of the piece and the credit/license of the chosen Commons photo (lib/archaeology/manifest.json).
// A photo is published only if its id is in the manifest with an allowed license; pieces without a photo are left out. Idempotent.
// Usage: node scripts/media/ingest-archaeology.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { ITEMS } from "./archaeology-items.mjs";

const DIR = "public/arqueologia";
const OUT = "lib/archaeology/items.json";
const MANIFEST = JSON.parse(readFileSync("lib/archaeology/manifest.json", "utf8"));
const OK = /^(public domain|pd|cc0|cc by(-sa)? [0-9.]+)/i;
const RECEIVED = existsSync("lib/archaeology/received.json") ? JSON.parse(readFileSync("lib/archaeology/received.json", "utf8")) : {};
// the credit is the one of the Commons file the photo matches (received.json), else the chosen photo of the piece
const creditFor = (id) => { const m = MANIFEST.find((x) => x.id === id); if (!m) return null; const want = RECEIVED[id]; if (!want) return m.best; return [m.best, ...(m.alternatives ?? [])].find((c) => c?.title === want) ?? null; };
const files = existsSync(DIR) ? readdirSync(DIR) : [];
const textOf = (it) => { const r = { ...it }; delete r.q; delete r.pick; return r; };

const out = [];
for (const it of ITEMS) {
  const src = files.find((f) => f.replace(/\.[^.]+$/, "") === it.id);
  if (!src) continue;
  const best = creditFor(it.id);
  if (!best || !OK.test(best.license) || /nc|nd/i.test(best.license.replace(/cc by-sa|cc by/i, ""))) { console.log("SKIP (no allowed license on record):", it.id); continue; }
  const dest = `${DIR}/${it.id}.jpg`;
  const tmp = `${DIR}/.tmp-${it.id}.jpg`;
  // already a processed JPEG (1100 px or less)? leave it: re-encoding every run would lose quality each time
  const dims = execFileSync("identify", ["-format", "%w %h", `${DIR}/${src}`], { encoding: "utf8" }).trim().split(" ").map(Number);
  const done = src === `${it.id}.jpg` && Math.max(...dims) <= 1100 && existsSync(OUT) && JSON.parse(readFileSync(OUT, "utf8")).some((x) => x.id === it.id);
  if (!done) { execFileSync("convert", [`${DIR}/${src}`, "-auto-orient", "-resize", "1100x1100>", "-strip", "-quality", "78", tmp]); renameSync(tmp, dest); }
  if (src !== `${it.id}.jpg`) execFileSync("rm", [`${DIR}/${src}`]);
  out.push({ ...textOf(it), image: `/arqueologia/${it.id}.jpg`, credit: { title: best.title.replace(/^File:/, ""), author: best.author, license: best.license, page: best.page } });
  console.log("OK  ", it.id, "|", best.license, "|", best.author);
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`${out.length}/${ITEMS.length} pieces with photo -> ${OUT} (the gallery opens at 6 or more)`);
