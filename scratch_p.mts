import { readFileSync } from "node:fs";
import { parseCcel } from "./lib/knowledge/ccel-text.ts";
const raw = readFileSync("data/raw/ccel/ttt.txt", "utf8");
const lines = raw.split("\n"); const hist = new Map<number, number>();
for (const l of lines) if (l.trim().length > 25) hist.set(l.length - l.trimStart().length, (hist.get(l.length - l.trimStart().length) ?? 0) + 1);
console.log([...hist].sort((a, b) => b[1] - a[1]).slice(0, 5), "refAt", raw.lastIndexOf("\nReferences\n"), raw.length);
console.log(parseCcel(raw).length);
