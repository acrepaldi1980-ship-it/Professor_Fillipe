// Loads the books of the historians for reading (hist_works, hist_units) from the public-domain texts already downloaded (Project Gutenberg and CCEL).
// Usage: NODE_OPTIONS=--use-env-proxy tsx --env-file=.env.local scripts/ingest/historians-read.ts [--dry]
import { readFileSync } from "node:fs";
import { blocks, parseBlocks, parseBookChapter, parseLetters, parseNumbered, type Unit } from "../../lib/historians/readers";
import { nsql } from "../neon.mjs";

const DRY = process.argv.includes("--dry");
const g = (id: string) => readFileSync(`data/raw/gutenberg/${id}.txt`, "utf8");
const c = readFileSync("data/raw/ccel/npnf201.txt", "utf8");
const lines = (raw: string) => raw.split("\n");
const find = (raw: string, re: RegExp, from = 0) => { const l = lines(raw); for (let i = from; i < l.length; i++) if (re.test(l[i])) return i + 1; return l.length; };

interface W { id: string; author: string; title: string; edition: string; note: string; units: Unit[] }
const works: W[] = [];

works.push({ id: "he", author: "eusebio", title: "História Eclesiástica", edition: "Arthur Cushman McGiffert, 1890 (Nicene and Post-Nicene Fathers, série 2, vol. 1), via CCEL; domínio público", note: "Livros 1 a 10. A tradução inglesa inclui as notas do tradutor, que podem aparecer no texto.", units: parseBookChapter(c, 5367, 51095, "HE") });
works.push({ id: "vc", author: "eusebio", title: "Vida de Constantino", edition: "Ernest Cushing Richardson, 1890 (NPNF, série 2, vol. 1), via CCEL; domínio público", note: "Livros 1 a 4.", units: parseBookChapter(c, 56317, 66041, "VC") });

const tib = g("7959"), annalsEnd = find(tib, /^[A-Z][A-Z ,.;:'-]{14,}$/, 6700);
const books: [string, number, number][] = [["Livro 1", 1011, 3004], ["Livro 2", 3005, 4375], ["Livro 3", 4376, 5410], ["Livro 4", 5411, 6545], ["Livro 5", 6546, 6666], ["Livro 6", 6667, annalsEnd - 1]];
works.push({ id: "annals", author: "tacito", title: "Anais (livros 1 a 6: o reinado de Tibério)", edition: "Thomas Gordon (1728) e Arthur Galton, ed. (1896), via Project Gutenberg nº 7959; domínio público", note: "Só os seis primeiros livros dos Anais, sem a numeração de capítulos desta tradução: a localização é pelo livro e pelo bloco. O livro 15 (Nero e os cristãos, 15.44) ainda não está disponível; falta uma tradução de domínio público.", units: books.flatMap(([part, a, b]) => parseBlocks(tib, a, b, part, `Anais ${part.replace("Livro ", "")}.`)) });

const ger = g("7524"), agr = find(ger, /^1\. The ancient custom/);
works.push({ id: "germania", author: "tacito", title: "Germânia", edition: "Tradução inglesa antiga (Gutenberg nº 7524, tradutor a verificar); domínio público", note: "46 capítulos.", units: parseNumbered(ger, 201, agr - 12, "Germ.") });
works.push({ id: "agricola", author: "tacito", title: "Agrícola", edition: "Tradução inglesa antiga (Gutenberg nº 7524, tradutor a verificar); domínio público", note: "46 capítulos.", units: parseNumbered(ger, agr, lines(ger).length, "Agr.") });

const pl = g("2811"), letters = parseLetters(pl, "Cartas");
works.push({ id: "letters", author: "plinio", title: "Cartas (livros 1 a 9)", edition: "William Melmoth (1746), seleção Harvard Classics (Gutenberg nº 2811); domínio público", note: "Seleção de cartas. A numeração é a de Melmoth: a carta aos cristãos, que as edições modernas numeram 10.96, aparece aqui como carta 97 do livro 10.", units: letters.filter((u) => u.part !== "Livro 10") });
works.push({ id: "trajan", author: "plinio", title: "Correspondência com Trajano (livro 10)", edition: "William Melmoth (1746), seleção Harvard Classics (Gutenberg nº 2811); domínio público", note: "Numeração de Melmoth (a carta sobre os cristãos é a 97 e a resposta de Trajano, a 98).", units: letters.filter((u) => u.part === "Livro 10") });

const su = g("6400");
const starts: [string, string, number][] = [["Júlio César e Augusto", "Júlio e Augusto", 5360], ["Tibério", "Tib.", 6637], ["Calígula", "Cal.", 8608], ["Cláudio", "Cl.", 9988], ["Nero", "Nero", 11293], ["Galba", "Galba", 13410], ["Otão", "Otão", 13933], ["Vitélio", "Vit.", 14245], ["Vespasiano", "Vesp.", 14680], ["Tito", "Tito", 15346], ["Domiciano", "Dom.", 15761]];
works.push({ id: "caesars", author: "suetonio", title: "Vidas dos Doze Césares", edition: "Alexander Thomson, revisto por Thomas Forester (1796; 1893), via Project Gutenberg nº 6400; domínio público (tradutores falecidos em 1803 e 1850, conferido à mão: a triagem automática não achou as datas)", note: "Sem numeração de capítulos nesta tradução: a localização é pela vida e pelo bloco. A edição tem notas do tradutor no texto.", units: starts.flatMap(([name, cite, a], i) => parseBlocks(su, a, (starts[i + 1]?.[2] ?? 16686) - 1, name, cite)) });

async function main() {
  void blocks;
  for (const w of works) console.log(`${w.id}: ${w.units.length} units, ${w.units.reduce((t, u) => t + u.text.split(/\s+/).length, 0)} words${w.units[0] ? ` (first: ${w.units[0].label})` : ""}`);
  if (!DRY) {
    for (const w of works) {
      await nsql("insert into hist_works (id, author, title, edition, note) values ($1,$2,$3,$4,$5) on conflict (id) do update set title=excluded.title, edition=excluded.edition, note=excluded.note", [w.id, w.author, w.title, w.edition, w.note]);
      const have = new Map<number, boolean>((await nsql("select ord, text_pt is not null as t from hist_units where work = $1", [w.id])).map((r: Record<string, unknown>) => [Number(r.ord), Boolean(r.t)]));
      await nsql("delete from hist_units where work = $1 and text_pt is null", [w.id]);
      const rows = w.units.map((u, i) => ({ work: w.id, ord: i + 1, part: u.part, label: u.label, title: u.title, text: u.text })).filter((r) => !have.get(r.ord));
      for (let i = 0; i < rows.length; i += 80) await nsql("insert into hist_units (work,ord,part,label,title,text) select work,ord,part,label,title,text from jsonb_to_recordset($1::jsonb) as t(work text,ord int,part text,label text,title text,text text) on conflict do nothing", [JSON.stringify(rows.slice(i, i + 80))]);
    }
    console.log("stored");
  }

}
main().catch((e) => { console.error(e); process.exit(1); });
