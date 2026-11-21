// Downloads the chosen free photo of each archaeology piece (lib/archaeology/manifest.json, built from the Commons metadata) politely:
// one request at a time, 25 s apart, and it WAITS for as long as Wikimedia asks (Retry-After) instead of hammering the server.
// Resumable: pieces that already have public/arqueologia/<id>.jpg are skipped. Writes lib/archaeology/items.json (texts + credit + license).
// Usage: node scripts/media/download-archaeology.mjs [id ...]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ITEMS } from "./archaeology-items.mjs";

const UA = "ProfessorFilipeBot/1.0 (educational Bible study app; low-volume, honours Retry-After)";
const MANIFEST = JSON.parse(readFileSync("lib/archaeology/manifest.json", "utf8"));
const OUT = "lib/archaeology/items.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_WAIT_S = 1200;

const uploadUrl = (title) => {
  const name = title.replace(/^File:/, "").replace(/ /g, "_");
  const h = createHash("md5").update(name).digest("hex");
  return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%27/g, "'")}`;
};

mkdirSync("public/arqueologia", { recursive: true });
const only = process.argv.slice(2);
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const done = new Map(prev.map((x) => [x.id, x]));
const textOf = (it) => { const r = { ...it }; delete r.q; delete r.pick; return r; };
const save = () => writeFileSync(OUT, JSON.stringify(ITEMS.filter((it) => done.has(it.id)).map((it) => done.get(it.id)), null, 1));

for (const it of ITEMS) {
  if (only.length && !only.includes(it.id)) continue;
  const file = `public/arqueologia/${it.id}.jpg`;
  if (existsSync(file) && done.has(it.id)) continue;
  const m = MANIFEST.find((x) => x.id === it.id);
  const c = m?.best;
  if (!c) { console.log("NO PHOTO", it.id); continue; }
  const url = uploadUrl(c.title);
  let buf = null;
  for (let i = 0; i < 4 && !buf; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null);
    if (res?.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
    const ra = Number(res?.headers.get("retry-after")) || 60;
    console.log(`  ${it.id}: HTTP ${res?.status ?? "err"}, waiting ${Math.min(ra, MAX_WAIT_S)} s as asked`);
    await sleep(Math.min(ra, MAX_WAIT_S) * 1000 + 5000);
  }
  if (!buf) { console.log("DL FAIL", it.id); continue; }
  writeFileSync(`/tmp/arq-${it.id}.bin`, buf);
  execFileSync("convert", [`/tmp/arq-${it.id}.bin`, "-auto-orient", "-resize", "1100x1100>", "-strip", "-quality", "78", file]);
  done.set(it.id, { ...textOf(it), image: `/arqueologia/${it.id}.jpg`, credit: { title: c.title.replace(/^File:/, ""), author: c.author, license: c.license, page: c.page } });
  save();
  console.log("OK  ", it.id, "|", c.license);
  await sleep(25000);
}
console.log(`${done.size}/${ITEMS.length} pieces with image`);
