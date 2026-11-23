// Cleans the machine-translated Portuguese in the database. The local translator (Opus-MT) leaks its language tag at the start of some sentences
// (">>por ⁇", "Por ⁇", "Por –") and prints an "unknown" mark (⁇) for letters its vocabulary lacks: ü (cinqüenta), æ (Cæsarea) and À (Às vezes).
// Idempotent. Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/translate/clean-pt.mjs
import { nsql } from "../neon.mjs";

/** [regex, replacement] in order. Postgres regular expressions. */
export const FIXES = [
  [">>\\s*por\\s*(<<)?\\s*⁇?\\s*", ""],
  ["(^|[.;:!?”\"\\)\\]]\\s+)Por\\s*⁇\\s*", "\\1"],
  ["(^|[.;:!?”\"\\)\\]]\\s+)Por\\s[–-]\\s+", "\\1"],
  ["q ⁇ ", "qu"],
  ["C ⁇ sarea", "Cesareia"],
  ["C ⁇ sar", "César"],
  ["Iren ⁇ us", "Ireneu"],
  ["(^|[.;:!?]\\s+)⁇ s ", "\\1Às "],
  // capitals with accents (the vocabulary has no Ã, Ç, Ê, Í...)
  ["N ⁇ O", "NÃO"], ["LI ⁇ O", "LIÇÃO"], ["VOC ⁇ ", "VOCÊ"], ["LICEN ⁇ A", "LICENÇA"], ["SITUA ⁇ O", "SITUAÇÃO"],
  [" ⁇ ndia", " Índia"], [" ⁇ dolos", " Ídolos"], [" ⁇ xodo", " Êxodo"], [" ⁇ sis", " Ísis"],
  // names with æ
  ["Pant ⁇ nus", "Panteno"], ["Ch ⁇ remon", "Querêmon"], ["Pr ⁇ torian", "Pretoriano"], ["Erythr ⁇ an", "Eritreia"], ["C ⁇ cilianus", "Ceciliano"],
  ["Nic ⁇ a", "Niceia"], ["Hymen ⁇ us", "Himeneu"], ["Hex ⁇ meron", "Hexameron"], ["Kalend ⁇ ", "Calendas"],
  // the leaked language tag in its other spellings (lower case, after quotes, doubled)
  ["(^|[^[:alnum:]])(>>)?(Porpor|[Pp]or)\\s*⁇\\s*", "\\1"],
  // what is still an isolated unknown mark between spaces carries no letter we can name: drop it
  ["\\s⁇\\s", " "],
];

/** Proper names the translator left in English or Latin, in the form used in Portuguese. Whole words only. */
const NAMES = { Livy: "Lívio", Josephus: "Josefo", Cornelius: "Cornélio", Tiberius: "Tibério", Augustus: "Augusto", Caesar: "César", Vespasian: "Vespasiano", Domitian: "Domiciano",
  Titus: "Tito", Claudius: "Cláudio", Caligula: "Calígula", Vitellius: "Vitélio", Otho: "Otão", Herod: "Herodes", Pilate: "Pilatos", Trajan: "Trajano", Pliny: "Plínio",
  Tacitus: "Tácito", Suetonius: "Suetônio", Eusebius: "Eusébio" };
for (const [en, pt] of Object.entries(NAMES)) FIXES.push([`\\m${en}\\M`, pt]);

const TARGETS = [["josephus_sections", "text_pt"], ["josephus_chapters", "title_pt"], ["hist_units", "text_pt"], ["hist_units", "title_pt"]];
const bad = "text_pt ~ '>>|⁇|(^|[.;:!?”\"\\)\\]] )Por [–-] |\\m(" + Object.keys(NAMES).join("|") + ")\\M'";

for (const [table, col] of TARGETS) {
  const cond = bad.replaceAll("text_pt", col);
  const [{ n: before }] = await nsql(`select count(*) as n from ${table} where ${cond}`);
  let expr = col;
  for (const [re, rep] of FIXES) expr = `regexp_replace(${expr}, '${re.replaceAll("'", "''")}', '${rep.replaceAll("'", "''")}', 'g')`;
  await nsql(`update ${table} set ${col} = ${expr} where ${cond}`);
  const [{ n: after }] = await nsql(`select count(*) as n from ${table} where ${cond}`);
  const [{ n: unk }] = await nsql(`select count(*) as n from ${table} where ${col} ~ '⁇'`);
  console.log(`${table}.${col}: ${before} com ruído antes, ${after} depois; ainda com ⁇: ${unk}`);
}
