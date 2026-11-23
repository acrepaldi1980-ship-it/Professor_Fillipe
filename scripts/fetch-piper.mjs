// Downloads the Piper pt_BR male voices (cadu = the production voice, faber = the older one; both CC0 datasets) into models/piper and trims the phonemizer data to pt/en/es.
// Usage: node scripts/fetch-piper.mjs   (needs bzip2/tar). The folder is gitignored; scripts/deploy-vercel.mjs ships models/.
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, cpSync } from "node:fs";
import { PT_BR_PRONUNCIATION } from "../lib/voice/pronunciation.mjs";

/** Brazilian pronunciation fixes for the espeak-ng phonemizer that Piper uses (see lib/voice/pronunciation.mjs). Idempotent. */
export function patchPronunciation(file) {
  if (!existsSync(file)) return;
  const have = readFileSync(file, "utf8");
  const add = PT_BR_PRONUNCIATION.filter((l) => !have.includes(l));
  if (add.length) appendFileSync(file, `\n${add.join("\n")}\n`);
}

for (const v of ["cadu", "faber"]) {
  const OUT = v === "faber" ? "models/piper" : `models/piper/${v}`; // each voice has its own tokens and phonemizer data
  if (existsSync(`${OUT}/pt_BR-${v}-medium.onnx`)) { if (v === "cadu") patchPronunciation(`${OUT}/espeak-ng-data/lang/roa/pt-BR`); console.log(`piper ${v} already there`); continue; }
  const tmp = `/tmp/pf-piper-${v}`;
  mkdirSync(tmp, { recursive: true });
  execSync(`curl -sL -o ${tmp}/m.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-pt_BR-${v}-medium.tar.bz2 && tar xjf ${tmp}/m.tar.bz2 -C ${tmp}`, { stdio: "inherit" });
  const src = `${tmp}/vits-piper-pt_BR-${v}-medium`;
  for (const f of readdirSync(`${src}/espeak-ng-data`)) if (f.endsWith("_dict") && !["pt_dict", "en_dict", "es_dict"].includes(f)) rmSync(`${src}/espeak-ng-data/${f}`);
  mkdirSync(OUT, { recursive: true });
  cpSync(src, OUT, { recursive: true });
  if (v === "cadu") patchPronunciation(`${OUT}/espeak-ng-data/lang/roa/pt-BR`); // faber stays exactly as the model ships
  console.log(`piper ${v} ready in`, OUT);
}
