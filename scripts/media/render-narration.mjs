// Pre-records the narration of every curiosity with the free male voice (Piper faber) and writes, per curiosity:
//   media-out/curiosidades/<id>.wav (temp), <id>.mp3 (64 kbps mono) and <id>.json (start/end of each sentence, for subtitles and the film).
// Usage: node scripts/media/render-narration.mjs [id ...]
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { CURIOSITIES } from "./curiosities-data.mjs";

const require = createRequire(process.cwd() + "/package.json");
const sherpa = require("sherpa-onnx-node");
const d = "models/piper";
const tts = new sherpa.OfflineTts({ model: { vits: { model: `${d}/pt_BR-faber-medium.onnx`, tokens: `${d}/tokens.txt`, dataDir: `${d}/espeak-ng-data` }, numThreads: 2, provider: "cpu" }, maxNumSentences: 1 });
const OUT = "media-out/curiosidades";
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const GAP = 0.45; // seconds of silence between sentences
const LEAD = 0.6; // before the first sentence

for (const c of CURIOSITIES) {
  if (only.length && !only.includes(c.id)) continue;
  const parts = [];
  const timeline = [];
  let t = LEAD;
  let sr = 22050;
  for (const sentence of c.text) {
    const a = tts.generate({ text: sentence, sid: 0, speed: 0.96 });
    sr = a.sampleRate;
    const dur = a.samples.length / sr;
    timeline.push({ text: sentence, start: +t.toFixed(2), end: +(t + dur).toFixed(2) });
    parts.push(a.samples);
    t += dur + GAP;
  }
  // assemble: lead silence + sentences separated by gaps
  const total = Math.ceil((t + 0.4) * sr);
  const all = new Float32Array(total);
  let pos = Math.round(LEAD * sr);
  for (const s of parts) { all.set(s, pos); pos += s.length + Math.round(GAP * sr); }
  sherpa.writeWave(`${OUT}/${c.id}.wav`, { samples: all, sampleRate: sr });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${OUT}/${c.id}.wav`, "-ac", "1", "-b:a", "64k", `${OUT}/${c.id}.mp3`]);
  writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify({ id: c.id, duration: +(total / sr).toFixed(2), sentences: timeline }));
  console.log(c.id.padEnd(26), (total / sr).toFixed(1) + "s");
}
