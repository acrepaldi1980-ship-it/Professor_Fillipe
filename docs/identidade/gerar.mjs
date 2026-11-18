// Gera as 3 direções visuais (D-13) como HTML estático e as capturas em PNG.
// Uso: node docs/identidade/gerar.mjs  (precisa do Playwright)
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const AVATARS = {
  // A: formas orgânicas e quentes, estilo aquarela
  a: `<svg viewBox="0 0 100 100" width="104" height="104"><defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#f6d9bb"/><stop offset="1" stop-color="#e9b98c"/></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="#e8d3b0" opacity=".7"/><path d="M14 52c0-24 16-38 36-38s36 14 36 38c0 22-16 36-36 36S14 74 14 52z" fill="url(#g)"/>
    <path d="M16 46c3-22 18-32 34-32s31 10 34 32c-7-9-19-14-34-14S23 37 16 46z" fill="#6b4a32"/><path d="M20 40c6-10 16-14 30-14" stroke="#8a6444" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="52" r="3" fill="#3b2a1d"/><circle cx="62" cy="52" r="3" fill="#3b2a1d"/>
    <path d="M32 50q-2 0-2 5M68 50q2 0 2 5" stroke="#3b2a1d" stroke-width="1.5" fill="none"/>
    <path d="M40 68q10 8 20 0" stroke="#9a4a2a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="30" cy="62" r="5" fill="#e59a74" opacity=".5"/><circle cx="70" cy="62" r="5" fill="#e59a74" opacity=".5"/>
    <path d="M20 84c8-8 20-10 30-10s22 2 30 10" fill="#b4532a" opacity=".9"/></svg>`,
  // B: traço fino de gravura, marinho e dourado
  b: `<svg viewBox="0 0 100 100" width="104" height="104"><circle cx="50" cy="50" r="47" fill="#1f3a5f"/><circle cx="50" cy="50" r="43" fill="none" stroke="#c9a227" stroke-width="1.2"/>
    <path d="M24 56c0-20 11-32 26-32s26 12 26 32-11 30-26 30-26-10-26-30z" fill="#f2e3c9" stroke="#c9a227" stroke-width="1"/>
    <path d="M24 48c2-17 12-24 26-24s24 7 26 24c-6-7-15-11-26-11s-20 4-26 11z" fill="#3a3f4a" stroke="#c9a227" stroke-width="1"/>
    <g stroke="#1b1b1b" stroke-width="1.6" fill="none"><circle cx="40" cy="55" r="5"/><circle cx="60" cy="55" r="5"/><path d="M45 55h10"/></g>
    <circle cx="40" cy="55" r="1.6" fill="#1b1b1b"/><circle cx="60" cy="55" r="1.6" fill="#1b1b1b"/>
    <path d="M42 72q8 5 16 0" stroke="#7a3b2e" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M28 88c6-6 14-8 22-8s16 2 22 8" fill="#c9a227" opacity=".95"/></svg>`,
  // C: formas planas geométricas, cores vivas
  c: `<svg viewBox="0 0 100 100" width="104" height="104"><defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs>
    <circle cx="50" cy="50" r="47" fill="url(#gc)"/><rect x="26" y="26" width="48" height="52" rx="22" fill="#ffd9b8"/>
    <path d="M26 46c0-14 10-22 24-22s24 8 24 22c-6-6-14-8-24-8s-18 2-24 8z" fill="#2a2350"/>
    <circle cx="41" cy="52" r="3.2" fill="#1b1740"/><circle cx="59" cy="52" r="3.2" fill="#1b1740"/>
    <rect x="35" y="47" width="12" height="11" rx="5" fill="none" stroke="#1b1740" stroke-width="1.8"/><rect x="53" y="47" width="12" height="11" rx="5" fill="none" stroke="#1b1740" stroke-width="1.8"/>
    <path d="M42 67q8 6 16 0" stroke="#d1486b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M22 90c4-10 16-12 28-12s24 2 28 12" fill="#f59e0b"/></svg>`,
};

const DIRECTIONS = {
  a: {
    nome: "A · Caminho",
    ideia: "Acolhedora e humana, como uma conversa à sombra de uma árvore. Cores de terra e papel, letras com serifa suave.",
    fonte: "Fraunces (títulos) + Nunito (texto)",
    link: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Nunito:wght@400;600;700&display=swap",
    css: `--bg:#fbf3e4;--card:#fffaf0;--ink:#2b2118;--muted:#7a6a58;--p:#b4532a;--p2:#5b6b3a;--chip:#f1e3c8;--on:#fff;--radius:22px;--h:'Fraunces',serif;--b:'Nunito',sans-serif;--user:#5b6b3a;--shadow:0 6px 18px rgba(120,80,40,.12);`,
    paleta: ["#fbf3e4", "#b4532a", "#5b6b3a", "#2b2118"],
  },
  b: {
    nome: "B · Biblioteca",
    ideia: "Sóbria e confiável, para quem prega e ensina. Azul-marinho e dourado, com ar de livro bem cuidado.",
    fonte: "Libre Baskerville (títulos) + Source Sans 3 (texto)",
    link: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=Source+Sans+3:wght@400;600&display=swap",
    css: `--bg:#f7f3ea;--card:#ffffff;--ink:#1b1b1b;--muted:#5d6370;--p:#1f3a5f;--p2:#c9a227;--chip:#ece4d0;--on:#fff;--radius:10px;--h:'Libre Baskerville',serif;--b:'Source Sans 3',sans-serif;--user:#1f3a5f;--shadow:0 2px 8px rgba(20,30,50,.12);`,
    paleta: ["#f7f3ea", "#1f3a5f", "#c9a227", "#1b1b1b"],
  },
  c: {
    nome: "C · Aurora",
    ideia: "Moderna e leve, pensada para jovens e para o celular. Cores vivas em degradê e formas redondas.",
    fonte: "Poppins (títulos) + DM Sans (texto)",
    link: "https://fonts.googleapis.com/css2?family=Poppins:wght@600&family=DM+Sans:wght@400;500;700&display=swap",
    css: `--bg:#f4f7fb;--card:#ffffff;--ink:#17163a;--muted:#6a6f8c;--p:#4f46e5;--p2:#14b8a6;--chip:#e6e8ff;--on:#fff;--radius:20px;--h:'Poppins',sans-serif;--b:'DM Sans',sans-serif;--user:linear-gradient(135deg,#4f46e5,#14b8a6);--shadow:0 8px 22px rgba(79,70,229,.16);`,
    paleta: ["#f4f7fb", "#4f46e5", "#14b8a6", "#f59e0b"],
  },
};

const page = (k, d) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="${d.link}"><title>${d.nome}</title>
<style>:root{${d.css}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--b);width:390px;height:844px;display:flex;flex-direction:column}
header{display:flex;flex-direction:column;align-items:center;padding:18px 16px 6px}h1{font-family:var(--h);font-size:19px;margin:6px 0 0}.st{font-size:13px;color:var(--muted);margin-top:2px}
main{flex:1;padding:8px 16px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.u{align-self:flex-end;max-width:82%;background:var(--user);color:var(--on);padding:12px 16px;border-radius:var(--radius) var(--radius) 6px var(--radius);font-size:16px;box-shadow:var(--shadow)}
.t{align-self:flex-start;max-width:92%;background:var(--card);padding:14px 16px;border-radius:var(--radius) var(--radius) var(--radius) 6px;font-size:16px;line-height:1.45;box-shadow:var(--shadow)}
.t b{font-family:var(--h)}.chips,.opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.chip{background:var(--chip);color:var(--p);padding:9px 14px;border-radius:999px;font-size:14px;font-weight:600}
.opt{background:var(--p);color:var(--on);padding:10px 14px;border-radius:calc(var(--radius) - 6px);font-size:14px;font-weight:600}
.src{font-size:12px;color:var(--muted);margin-top:8px}
.bar{display:flex;align-items:center;gap:10px;padding:10px 14px}.mic{width:58px;height:58px;border-radius:50%;background:var(--p);color:var(--on);display:grid;place-items:center;font-size:26px;box-shadow:var(--shadow)}
.in{flex:1;height:48px;border-radius:var(--radius);border:1.5px solid color-mix(in srgb,var(--ink) 18%,transparent);background:var(--card);padding:0 14px;display:flex;align-items:center;color:var(--muted)}
nav{display:flex;justify-content:space-around;padding:8px 6px 18px;border-top:1px solid color-mix(in srgb,var(--ink) 10%,transparent);background:var(--card);font-size:11px;color:var(--muted)}
nav div{display:flex;flex-direction:column;align-items:center;gap:2px}nav .on{color:var(--p);font-weight:700}nav i{font-style:normal;font-size:20px}</style></head><body>
<header>${AVATARS[k]}<h1>Professor Filipe</h1><div class="st">O professor está falando</div></header>
<main><div class="u">Por que Elias fugiu de Jezabel?</div>
<div class="t"><b>Boa pergunta, Ana!</b> Depois de vencer os profetas de Baal, Elias recebeu uma ameaça de morte da rainha Jezabel e, cansado e com medo, fugiu para o deserto <span class="chip" style="padding:3px 9px;font-size:13px">1 Reis 19:3</span>. Já se sentiu assim, esgotado depois de uma grande vitória?
<div class="chips"><span class="chip">1 Reis 19:1-4</span><span class="chip">Elias (Easton)</span></div>
<div class="opts"><span class="opt">Aprofundar</span><span class="opt">Ver no mapa</span><span class="opt">Seguir adiante</span></div>
<div class="src">Fontes: Bíblia Livre 2018; Easton, verbete Elijah</div></div></main>
<div class="bar"><div class="mic">🎤</div><div class="in">Escreva sua pergunta…</div></div>
<nav><div class="on"><i>🏠</i>Início</div><div><i>💬</i>Estudar</div><div><i>🔁</i>Revisão</div><div><i>📓</i>Caderno</div><div><i>👤</i>Conta</div></nav></body></html>`;

mkdirSync("docs/identidade", { recursive: true });
const browser = await chromium.launch();
for (const [k, d] of Object.entries(DIRECTIONS)) {
  writeFileSync(`docs/identidade/direcao-${k}.html`, page(k, d));
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`file://${process.cwd()}/docs/identidade/direcao-${k}.html`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `docs/identidade/direcao-${k}.png` });
  await ctx.close();
  console.log("ok", k, d.nome);
}
await browser.close();
