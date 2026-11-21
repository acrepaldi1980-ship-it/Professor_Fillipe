// Downloads the Piper pt_BR male voice (faber, CC0 dataset) into models/piper and trims the phonemizer data to pt/en/es.
// Usage: node scripts/fetch-piper.mjs   (needs bzip2/tar). The folder is gitignored; scripts/deploy-vercel.mjs ships models/.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, cpSync } from "node:fs";

const URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-pt_BR-faber-medium.tar.bz2";
const OUT = "models/piper";
if (existsSync(`${OUT}/pt_BR-faber-medium.onnx`)) { console.log("piper model already there"); process.exit(0); }
const tmp = "/tmp/pf-piper";
mkdirSync(tmp, { recursive: true });
execSync(`curl -sL -o ${tmp}/m.tar.bz2 ${URL} && tar xjf ${tmp}/m.tar.bz2 -C ${tmp}`, { stdio: "inherit" });
const src = `${tmp}/vits-piper-pt_BR-faber-medium`;
for (const f of readdirSync(`${src}/espeak-ng-data`)) if (f.endsWith("_dict") && !["pt_dict", "en_dict", "es_dict"].includes(f)) rmSync(`${src}/espeak-ng-data/${f}`);
mkdirSync(OUT, { recursive: true });
cpSync(src, OUT, { recursive: true });
console.log("piper model ready in", OUT);
