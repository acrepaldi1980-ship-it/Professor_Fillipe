// Voice server: the Kokoro-82M narrator voice (pt-BR) over HTTP, to run on a free machine with more CPU than the app host (see README.md).
// POST /tts  { "text": "...", "speaker": 44, "speed": 0.9 }  with  Authorization: Bearer <VOICE_TOKEN>  ->  audio/wav (16-bit mono)
// The app adds the announcer finish (EQ, level, pauses); this server only speaks. GET /health -> 200.
import { createServer } from "node:http";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sherpa = require("sherpa-onnx-node");
const DIR = process.env.KOKORO_DIR ?? "/models/kokoro";
const TOKEN = process.env.VOICE_TOKEN ?? "";
const PORT = Number(process.env.PORT ?? 7860);
if (!TOKEN) { console.error("VOICE_TOKEN is required"); process.exit(1); }
const tts = new sherpa.OfflineTts({
  model: { kokoro: { model: `${DIR}/model.int8.onnx`, voices: `${DIR}/voices.bin`, tokens: `${DIR}/tokens.txt`, dataDir: `${DIR}/espeak-ng-data`, lexicon: "", lang: "pt-br" }, numThreads: Number(process.env.THREADS ?? 4), provider: "cpu" },
  maxNumSentences: 1,
});
function wav(samples, sr) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  return b;
}
createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200).end("ok"); return; }
  if (req.method !== "POST" || req.url !== "/tts") { res.writeHead(404).end(); return; }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401).end(); return; }
  let body = "";
  for await (const c of req) { body += c; if (body.length > 4000) { res.writeHead(413).end(); return; } }
  try {
    const { text, speaker = 44, speed = 0.9 } = JSON.parse(body);
    if (typeof text !== "string" || !text.trim() || text.length > 450) { res.writeHead(400).end(); return; }
    const a = tts.generate({ text, sid: Number(speaker), speed: Number(speed) });
    res.writeHead(200, { "Content-Type": "audio/wav" }).end(wav(a.samples, a.sampleRate));
  } catch (e) { res.writeHead(500).end(String(e).slice(0, 200)); }
}).listen(PORT, () => console.log(`voice server on :${PORT}`));
