// Which API endpoints and pages are mentioned in no test? (static heuristic: a test file must contain the route's static path pieces.)
// Usage: node scripts/qa-coverage.mjs   (exit 1 if something is uncovered)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const tests = [...walk("tests")].filter((f) => /\.(mjs|ts)$/.test(f)).map((f) => ({ f, t: readFileSync(f, "utf8") }));
const lib = [...walk("lib")].filter((f) => /\.test\./.test(f));
const routes = walk("app/api").filter((f) => f.endsWith("route.ts")).map((f) => f.replace("app/api/v1/", "").replace("/route.ts", ""));
const study = readFileSync("app/api/v1/study/[...path]/route.ts", "utf8");
for (const m of study.matchAll(/kind === "(\w[\w-]*)"|p\[0\] === "(\w[\w-]*)"/g)) routes.push(`study/${m[1] ?? m[2]}`);
const covered = (route) => {
  const segs = route.split("/").filter((s) => !s.startsWith("[") && s !== "study");
  const last = segs[segs.length - 1];
  return tests.some(({ t }) => segs.every((s) => t.includes(s)) && t.includes(last));
};
const bad = [...new Set(routes)].filter((r) => !covered(r)).sort();
const pages = walk("app").filter((f) => f.endsWith("page.tsx")).map((f) => f.replace(/^app\//, "").replace(/\(.*?\)\//g, "").replace("/page.tsx", "").replace("page.tsx", ""));
const pageBad = pages.filter((p) => { const key = p === "" ? "/" : "/" + p.replace(/\[.*?\]/g, ""); return !tests.some(({ t }) => t.includes(key) || t.includes(`"${key.replace(/\/$/, "")}`)); });
console.log(`API endpoints: ${new Set(routes).size}, without any test mention: ${bad.length}`); bad.forEach((r) => console.log("  -", r));
console.log(`Pages: ${pages.length}, without any test mention: ${pageBad.length}`); pageBad.forEach((p) => console.log("  -", "/" + p));
process.exit(bad.length || pageBad.length ? 1 : 0);
