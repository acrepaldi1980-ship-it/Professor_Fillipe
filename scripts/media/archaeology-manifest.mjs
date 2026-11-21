// Builds the shopping list of free photos for the archaeology gallery WITHOUT downloading any image: it only asks the Wikimedia Commons query API
// (title, license, author, page) for the best candidates of each piece. The owner downloads the chosen files from the Commons pages in a normal
// browser and drops them in public/arqueologia/<id>.jpg; scripts/media/ingest-archaeology.mjs then builds the gallery with the credits.
// Usage: node scripts/media/archaeology-manifest.mjs   -> lib/archaeology/manifest.json and docs/ARQUEOLOGIA_FOTOS.md
import { mkdirSync, writeFileSync } from "node:fs";
import { ITEMS } from "./archaeology-items.mjs";

const UA = "ProfessorFilipeBot/1.0 (educational Bible study app)";
const OK = /^(public domain|pd|cc0|cc by(?!-nc)(?!-nd)(-sa)? [0-9.]+)/i;
const BAD = /(nc|nd)\b/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function api(params) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params }), { headers: { "User-Agent": UA } });
    if (r.status === 429) { const ra = Number(r.headers.get("retry-after")) || 0; if (ra > 120) throw new Error("rate limited " + ra); await sleep(Math.max(ra, 5) * 1000); continue; }
    if (!r.ok) throw new Error("commons " + r.status);
    return r.json();
  }
  throw new Error("commons rate limit");
}

const out = [];
for (const it of ITEMS) {
  await sleep(1500);
  let cands = [];
  try {
    const d = await api({ action: "query", generator: "search", gsrsearch: it.q + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|extmetadata|size|mime" });
    cands = Object.values(d.query?.pages ?? {}).map((p) => {
      const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
      return { title: p.title.replace(/^File:/, ""), index: p.index, w: ii?.width, h: ii?.height, mime: ii?.mime, license: strip(m.LicenseShortName?.value), author: strip(m.Artist?.value).slice(0, 100), page: ii?.descriptionurl, desc: strip(m.ImageDescription?.value).slice(0, 120) };
    }).sort((a, b) => a.index - b.index).filter((c) => /jpeg/.test(c.mime ?? "") && c.w >= 900 && c.h >= 500 && OK.test(c.license) && !BAD.test(c.license));
  } catch (e) { console.log("ERR", it.id, e.message); }
  const [best, ...alts] = cands;
  console.log(best ? "OK  " : "NONE", it.id, best ? `| ${best.license} | ${best.title.slice(0, 60)}` : "");
  out.push({ id: it.id, name: it.name, best: best ?? null, alternatives: alts.slice(0, 2) });
}
mkdirSync("lib/archaeology", { recursive: true });
writeFileSync("lib/archaeology/manifest.json", JSON.stringify(out, null, 1));
const md = ["# Fotos da galeria de arqueologia (lista de download)", "",
  "Baixe cada foto da página do Commons indicada (botão **Baixar** > tamanho médio ou grande, em um navegador comum) e salve em `public/arqueologia/<id>.jpg` com o nome da primeira coluna. Depois rode `node scripts/media/ingest-archaeology.mjs`: ele reduz as imagens, grava autor e licença de cada uma e monta a galeria.", "",
  "Só entram imagens em domínio público, CC0, CC BY ou CC BY-SA (nunca NC/ND). Se uma peça aparecer como SEM FOTO ou você preferir outra, use uma das alternativas.", "",
  "| Arquivo a salvar | Peça | Foto escolhida (página) | Licença | Autor | Alternativas |", "| --- | --- | --- | --- | --- | --- |",
  ...out.map((o) => `| \`${o.id}.jpg\` | ${o.name} | ${o.best ? `[${o.best.title}](${o.best.page})` : "**SEM FOTO**"} | ${o.best?.license ?? ""} | ${o.best?.author ?? ""} | ${o.alternatives.map((a) => `[${a.title.slice(0, 40)}](${a.page})`).join("; ")} |`)];
writeFileSync("docs/ARQUEOLOGIA_FOTOS.md", md.join("\n") + "\n");
console.log(`${out.filter((o) => o.best).length}/${out.length} pieces with a candidate -> docs/ARQUEOLOGIA_FOTOS.md`);
