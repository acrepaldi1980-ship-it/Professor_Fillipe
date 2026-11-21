// Renders the mini-film of each curiosity (RF-M18-02): free images with a slow zoom (Ken Burns) and cross-fades, burned-in subtitles
// timed by the narration timeline, the title card and the credit line. Output: media-out/curiosidades/<id>.mp4 and <id>.jpg (poster).
// Usage: node scripts/media/render-films.mjs [id ...]   (needs render-narration.mjs and fetch-archaeology.mjs first)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CURIOSITIES } from "./curiosities-data.mjs";

const W = 960, H = 540, FPS = 24, FADE = 0.8;
const OUT = "media-out/curiosidades";
const only = process.argv.slice(2);
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const ass = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${s}`; };
const esc = (s) => s.replace(/\n/g, " ").replace(/[{}]/g, "");
function wrap(text, max = 46) {
  const words = text.split(" "); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  lines.push(cur.trim()); return lines.join("\\N");
}

for (const c of CURIOSITIES) {
  if (only.length && !only.includes(c.id)) continue;
  const tl = JSON.parse(readFileSync(`${OUT}/${c.id}.json`, "utf8"));
  const imgs = [...new Set(c.images)].map((id) => `public/arqueologia/${id}.jpg`).filter((f) => existsSync(f));
  if (!imgs.length) { console.log("SKIP (no image yet):", c.id); continue; }
  const dur = tl.duration;
  const n = imgs.length;
  const seg = (dur + FADE * (n - 1)) / n; // each clip is a bit longer than its share so that the fades overlap
  // 1) one zoom clip per image
  const clips = [];
  imgs.forEach((f, i) => {
    const out = `/tmp/film-${c.id}-${i}.mp4`;
    const frames = Math.ceil(seg * FPS);
    const zoomIn = i % 2 === 0;
    const z = zoomIn ? `min(1.0+0.0007*on,1.25)` : `max(1.25-0.0007*on,1.0)`;
    // the whole picture over a blurred copy of itself, so portrait photos are not cropped
    const comp = `/tmp/film-${c.id}-${i}.jpg`;
    execFileSync("convert", [f, "-auto-orient", "(", "+clone", "-resize", `${W * 2}x${H * 2}^`, "-gravity", "center", "-extent", `${W * 2}x${H * 2}`, "-blur", "0x30", "-brightness-contrast", "-25x0", ")", "(", "-clone", "0", "-resize", `${W * 2 - 40}x${H * 2 - 40}`, ")", "-delete", "0", "-gravity", "center", "-compose", "over", "-composite", comp]);
    ff(["-loop", "1", "-t", String(seg + 0.1), "-i", comp, "-vf", `scale=${W * 2}:${H * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p`, "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", out]);
    clips.push(out);
  });
  // 2) cross-fade them together
  let joined = clips[0];
  if (n > 1) {
    const inputs = clips.flatMap((x) => ["-i", x]);
    let chain = "", prev = "[0:v]", offset = 0;
    for (let i = 1; i < n; i++) { offset += seg - FADE; chain += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[v${i}];`; prev = `[v${i}]`; }
    joined = `/tmp/film-${c.id}-joined.mp4`;
    ff([...inputs, "-filter_complex", chain.slice(0, -1), "-map", prev, "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", joined]);
  }
  // 3) subtitles (ASS): title at the start, sentences by their narration time, credit at the end
  const lines = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${W}`, `PlayResY: ${H}`, "",
    "[V4+ Styles]", "Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV",
    "Style: Sub,Noto Sans,25,&H00FFFFFF,&H00000000,&H80000000,0,1,2.4,0.5,2,50,50,34",
    "Style: Title,Noto Serif,38,&H00FFFFFF,&H00000000,&H80000000,1,1,3,1,5,60,60,20",
    "Style: Credit,Noto Sans,16,&H00DDDDDD,&H00000000,&H80000000,0,1,1.5,0,2,30,30,10", "",
    "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    `Dialogue: 0,${ass(0.2)},${ass(Math.min(0.6 + 2.6, tl.sentences[0].start + 1.2))},Title,,0,0,0,,{\\fad(400,500)}${esc(wrap(c.title, 28))}`,
    ...tl.sentences.map((s) => `Dialogue: 0,${ass(Math.max(s.start, 2.8))},${ass(s.end + 0.3)},Sub,,0,0,0,,${esc(wrap(s.text))}`),
    `Dialogue: 0,${ass(Math.max(0, dur - 3.2))},${ass(dur)},Credit,,0,0,0,,Imagens: Wikimedia Commons (créditos no app)  ·  Narração por voz sintética (IA)`,
  ];
  writeFileSync(`/tmp/film-${c.id}.ass`, lines.join("\n"));
  // 4) final: video + subtitles + narration
  ff(["-i", joined, "-i", `${OUT}/${c.id}.mp3`, "-vf", `subtitles=/tmp/film-${c.id}.ass,fade=t=in:st=0:d=0.5,fade=t=out:st=${(dur - 0.6).toFixed(2)}:d=0.6`, "-af", `afade=t=out:st=${(dur - 0.5).toFixed(2)}:d=0.5`, "-t", String(dur), "-c:v", "libx264", "-preset", "medium", "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", `${OUT}/${c.id}.mp4`]);
  ff(["-i", `${OUT}/${c.id}.mp4`, "-ss", "6", "-frames:v", "1", "-q:v", "4", `${OUT}/${c.id}.jpg`]);
  console.log(c.id.padEnd(26), (existsSync(`${OUT}/${c.id}.mp4`) ? (readFileSync(`${OUT}/${c.id}.mp4`).length / 1e6).toFixed(1) + " MB" : "FAILED"), n + " images");
}
