// Tries the Gemini male voices on the greeting sentence and reports each voice's median pitch next to the video's (~131 Hz),
// writing the clips to $OUT (default /tmp/voices) so the owner can listen. Needs GEMINI_API_KEY with billing credit.
// Usage: NODE_OPTIONS=--use-env-proxy node --env-file=.env.local scripts/voice-test.mjs [Voice1 Voice2 ...]
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.env.OUT ?? "/tmp/voices";
mkdirSync(OUT, { recursive: true });
const voices = process.argv.slice(2).length ? process.argv.slice(2) : ["Charon", "Orus", "Alnilam", "Algenib", "Iapetus", "Enceladus", "Umbriel", "Schedar", "Achird", "Sadaltager"];
const text = "Olá! Que bom ter você aqui! Eu sou o Filipe e juntos vamos aprender as incríveis histórias da Palavra de Deus. Vamos começar?";

function f0(pcm, sr = 24000) {
  const n = pcm.length / 2, d = new Int16Array(pcm.buffer, pcm.byteOffset, n), out = [];
  for (let s = 0; s + 1600 < n; s += 800) {
    let e = 0; for (let i = 0; i < 1600; i++) e += d[s + i] * d[s + i];
    if (e / 1600 < 2e5) continue;
    let best = 0, bl = 0;
    for (let lag = Math.floor(sr / 300); lag < Math.floor(sr / 70); lag++) { let c = 0; for (let i = 0; i < 1200; i += 2) c += d[s + i] * d[s + i + lag]; if (c > best) { best = c; bl = lag; } }
    if (bl) out.push(sr / bl);
  }
  out.sort((a, b) => a - b); return out.length ? Math.round(out[Math.floor(out.length / 2)]) : null;
}

for (const v of voices) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Diga em português do Brasil, com voz calorosa, calma e acolhedora de um professor: ${text}` }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v } } } } }),
  });
  if (!res.ok) { console.log(v, "ERROR", res.status, (await res.text()).slice(0, 120)); if (res.status === 402) break; continue; }
  const j = await res.json(); const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  const pcm = Buffer.from(b64, "base64"); writeFileSync(`${OUT}/${v}.pcm`, pcm);
  console.log(v.padEnd(10), "pitch", f0(new Uint8Array(pcm)), "Hz (video: 131)");
}
