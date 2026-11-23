// Downloads Kokoro-82M (int8, Apache-2.0) from the sherpa-onnx release and keeps only what Portuguese needs in models/kokoro.
// Usage: node scripts/fetch-kokoro.mjs   (needs bzip2/tar). The folder is gitignored; scripts/deploy-vercel.mjs ships models/.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, cpSync } from "node:fs";
const URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_0.tar.bz2";
const OUT = "models/kokoro", TMP = "/tmp/kokoro-dl";
if (existsSync(`${OUT}/model.int8.onnx`)) { console.log("kokoro model already there"); process.exit(0); }
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); mkdirSync(OUT, { recursive: true });
execSync(`curl -sL --fail "${URL}" | tar xj -C ${TMP}`, { stdio: "inherit" });
const src = `${TMP}/kokoro-int8-multi-lang-v1_0`;
for (const f of ["model.int8.onnx", "voices.bin", "tokens.txt", "espeak-ng-data", "LICENSE"]) cpSync(`${src}/${f}`, `${OUT}/${f}`, { recursive: true });
for (const f of readdirSync(`${OUT}/espeak-ng-data`)) if (f.endsWith("_dict") && !["pt_dict", "en_dict", "es_dict"].includes(f)) rmSync(`${OUT}/espeak-ng-data/${f}`); // keep pt/en/es only
rmSync(TMP, { recursive: true, force: true });
console.log("kokoro model ready in", OUT);
