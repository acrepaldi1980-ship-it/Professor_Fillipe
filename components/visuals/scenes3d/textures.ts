"use client";

// Procedural textures drawn on a canvas (no files, no network): wood grain, limestone blocks, linen weave and hammered metal.
// They give the scenes material detail; all generated once and reused.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

const cache = new Map<string, CanvasTexture>();
function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat: [number, number] = [1, 1]) {
  const k = `${key}|${repeat}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}
// small deterministic noise so the textures never change between renders
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export const woodTexture = (base = "#7a5230", repeat: [number, number] = [2, 1]) =>
  make(`wood${base}`, 256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const y = rnd() * s, a = 0.05 + rnd() * 0.16;
      g.strokeStyle = `rgba(30,15,5,${a})`; g.lineWidth = 0.6 + rnd() * 2;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x / 38 + i) * (2 + rnd() * 3));
      g.stroke();
    }
    for (let i = 0; i < 5; i++) { g.fillStyle = "rgba(25,12,4,0.35)"; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 5 + rnd() * 6, 2 + rnd() * 3, 0, 0, 7); g.fill(); }
  }, repeat);

export const stoneTexture = (repeat: [number, number] = [3, 2]) =>
  make("stone", 256, (g, s) => {
    g.fillStyle = "#d9cdb0"; g.fillRect(0, 0, s, s);
    const rows = 4, h = s / rows;
    for (let r = 0; r < rows; r++) {
      const w = s / 2, off = r % 2 ? w / 2 : 0;
      for (let b = -1; b < 3; b++) {
        const shade = 196 + Math.floor(rnd() * 26);
        g.fillStyle = `rgb(${shade},${shade - 10},${shade - 36})`;
        g.fillRect(off + b * w + 2, r * h + 2, w - 4, h - 4);
        for (let n = 0; n < 40; n++) { g.fillStyle = `rgba(90,70,40,${rnd() * 0.08})`; g.fillRect(off + b * w + rnd() * w, r * h + rnd() * h, 2, 2); }
      }
    }
    g.strokeStyle = "rgba(95,80,55,0.7)"; g.lineWidth = 3;
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * h); g.lineTo(s, r * h); g.stroke(); }
  }, repeat);

export const linenTexture = (repeat: [number, number] = [8, 2]) =>
  make("linen", 128, (g, s) => {
    g.fillStyle = "#f2ead6"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 3) { g.fillStyle = `rgba(150,130,95,${0.08 + rnd() * 0.08})`; g.fillRect(i, 0, 1, s); g.fillRect(0, i, s, 1); }
  }, repeat);

export const metalTexture = (base: string) =>
  make(`metal${base}`, 128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? "255,240,180" : "60,40,0"},${rnd() * 0.12})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 2 + rnd() * 5, 0, 7); g.fill(); }
  }, [2, 2]);
