// Finds a free photo on Wikimedia Commons for each archaeology piece, downloads it (1100 px wide JPEG) into public/arqueologia and writes
// lib/archaeology/items.json with the texts, credits and license. Allowed: public domain, CC0, CC BY, CC BY-SA (gallery only, unaltered).
// Usage: node scripts/media/fetch-archaeology.mjs [id ...]   (re-run for a piece after changing its `q` or `pick`)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ITEMS } from "./archaeology-items.mjs";

const UA = "ProfessorFilipeBot/1.0 (educational Bible study app; contact: owner)";
const OK = /^(public domain|pd|cc0|cc by(?!-nc)(?!-nd)(-sa)? [0-9.]+|cc by(-sa)? [0-9.]+)/i;
const BAD = /(nc|nd)\b/i;
const OUT = "lib/archaeology/items.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function api(params) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params }), { headers: { "User-Agent": UA } });
    if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!r.ok) throw new Error("commons " + r.status);
    return r.json();
  }
  throw new Error("commons rate limit");
}

async function candidates(q) {
  const d = await api({ action: "query", generator: "search", gsrsearch: q + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|extmetadata|size|mime" });
  return Object.values(d.query?.pages ?? {}).map((p) => {
    const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
    return { title: p.title, index: p.index, url: ii?.url, bytes: ii?.size, w: ii?.width, h: ii?.height, mime: ii?.mime, license: strip(m.LicenseShortName?.value), author: strip(m.Artist?.value).slice(0, 120), page: ii?.descriptionurl, desc: strip(m.ImageDescription?.value).slice(0, 140) };
  }).sort((a, b) => a.index - b.index).filter((c) => c.url && /jpeg/.test(c.mime ?? "") && c.w >= 900 && c.h >= 500 && (c.bytes ?? 0) < 9_000_000 && OK.test(c.license) && !BAD.test(c.license));
}

mkdirSync("public/arqueologia", { recursive: true });
mkdirSync("lib/archaeology", { recursive: true });
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const only = process.argv.slice(2);
const out = [];
for (const it of ITEMS) {
  const old = prev.find((x) => x.id === it.id);
  if (old && !only.includes(it.id) && existsSync(`public/arqueologia/${it.id}.jpg`)) { out.push({ ...old, ...pickText(it) }); continue; }
  if (only.length && !only.includes(it.id)) { if (old) out.push({ ...old, ...pickText(it) }); continue; }
  await sleep(1200);
  let cands = [];
  try { cands = await candidates(it.q); } catch (e) { console.log("ERR", it.id, e.message); }
  const c = cands[it.pick ?? 0];
  if (!c) { console.log("NONE", it.id, "(no free image found for:", it.q + ")"); continue; }
  // the thumb host is not reachable from every network: the same path exists on upload.wikimedia.org
  const url = c.url;
  let buf = null;
  for (let i = 0; i < 3 && !buf; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
      else { const ra = Number(res.headers.get("retry-after")) || 0; console.log("  wait", res.status, ra); if (ra > 300) { console.log("  rate limited for", ra, "s: stop here and re-run later"); process.exit(2); } await sleep(Math.max(ra * 1000, 20000 * (i + 1))); }
    } catch { await sleep(3000); }
  }
  if (!buf) { console.log("DL FAIL", it.id); continue; }
  writeFileSync(`/tmp/arq-${it.id}.bin`, buf);
  execFileSync("convert", [`/tmp/arq-${it.id}.bin`, "-auto-orient", "-resize", "1100x1100>", "-strip", "-quality", "78", `public/arqueologia/${it.id}.jpg`]);
  console.log("OK  ", it.id, "|", c.license, "|", c.title.slice(0, 60));
  writeFileSync(OUT, JSON.stringify([...out, { ...pickText(it), image: `/arqueologia/${it.id}.jpg`, credit: { title: c.title.replace(/^File:/, ""), author: c.author, license: c.license, page: c.page } }], null, 1));
  await sleep(15000); // be polite: Wikimedia rate-limits fast downloads
  out.push({ ...pickText(it), image: `/arqueologia/${it.id}.jpg`, credit: { title: c.title.replace(/^File:/, ""), author: c.author, license: c.license, page: c.page } });
}
function pickText(it) { const rest = { ...it }; delete rest.q; delete rest.pick; return rest; }
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`${out.filter((x) => x.image).length}/${ITEMS.length} pieces with image -> ${OUT}`);
