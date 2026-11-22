// Runs the whole quality suite in one command: lint, typecheck, unit tests, portability, static build, then every e2e script against a local
// production build with a mock AI (no quota used). Writes docs/QA_RELATORIO.md. Usage: node scripts/qa-all.mjs [--skip-build] [--only name,name]
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { sql } from "./db.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const env = { ...process.env, NODE_OPTIONS: "--use-env-proxy", GLOBAL_NM: spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim(), MOCK_URL: "http://localhost:4010", APP_URL: "http://localhost:3100",
  LLM_ONLY: "mock", LLM_EXTRA: JSON.stringify([{ id: "mock", baseUrl: "http://localhost:4010/v1", keyEnv: "HOME", models: [{ name: "mock-model", tier: 1, tools: true }] }]) };
const sh = (cmd, a, o = {}) => spawnSync(cmd, a, { encoding: "utf8", env, ...o });
const results = [];
const step = (name, fn) => { const t = Date.now(); let ok = false, note = ""; try { const r = fn(); ok = r.ok; note = r.note ?? ""; } catch (e) { note = String(e).slice(0, 200); } results.push({ name, ok, note, s: Math.round((Date.now() - t) / 1000) }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${note}`); };

if (!only) {
  step("eslint (0 warnings allowed)", () => { const r = sh("npx", ["eslint", ".", "--max-warnings", "0"]); return { ok: r.status === 0, note: r.stdout.split("\n").slice(-4).join(" ").slice(0, 160) }; });
  step("typecheck", () => ({ ok: sh("npx", ["tsc", "--noEmit"]).status === 0 }));
  step("unit tests", () => { const r = sh("npx", ["vitest", "run"]); return { ok: r.status === 0, note: (r.stdout.match(/Tests\s+.*/) ?? [""])[0] }; });
  step("portability", () => ({ ok: sh("npm", ["run", "-s", "check:portability"]).status === 0 }));
  step("static build", () => ({ ok: sh("npm", ["run", "-s", "check:static-build"]).status === 0 }));
}
if (!args.includes("--skip-build")) step("production build", () => ({ ok: sh("npx", ["next", "build"]).status === 0 }));

const procs = [];
spawnSync("pkill", ["-f", "next-server"]); spawnSync("pkill", ["-f", "mock-llm"]);
procs.push(spawn("npx", ["next", "start", "-p", "3100"], { env, stdio: "ignore" }));
await new Promise((r) => setTimeout(r, 9000));

const scripts = readdirSync("tests/e2e").filter((f) => f.endsWith(".mjs") && f !== "mock-llm.mjs" && !f.startsWith("_")).map((f) => f.replace(".mjs", "")).filter((f) => !only || only.includes(f));
// The mock AI never fails by default (stable runs); only the scripts that test failover ask for failures.
const FAIL_RATE = { research: "0.25" };
let mock = null;
for (const name of scripts) {
  mock?.kill("SIGTERM"); spawnSync("pkill", ["-f", "mock-llm"]);
  mock = spawn("node", ["tests/e2e/mock-llm.mjs", "4010"], { env: { ...env, MOCK_FAIL: FAIL_RATE[name] ?? "0" }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  await sql("delete from llm_cooldowns").catch(() => undefined); // endpoints paused by an earlier script must not starve this one
  step(`e2e ${name}`, () => {
    const r = sh("node", [`tests/e2e/${name}.mjs`], { timeout: 420000, maxBuffer: 20_000_000 });
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    const fails = out.split("\n").filter((l) => /^FAIL|^ERROR|Error:/.test(l)).slice(0, 6);
    const pass = (out.match(/^PASS/gm) ?? []).length;
    return { ok: r.status === 0 && !fails.length, note: `${pass} ok` + (fails.length ? ` | ${fails.join(" | ").slice(0, 400)}` : "") };
  });
}
mock?.kill("SIGTERM");
for (const p of procs) p.kill("SIGTERM");
spawnSync("pkill", ["-f", "next-server"]);
const md = ["# Relatório de qualidade (gerado por `scripts/qa-all.mjs`)", "", `Data: ${new Date().toISOString()}`, "", "| Etapa | Resultado | Tempo | Observação |", "| --- | --- | --- | --- |", ...results.map((r) => `| ${r.name} | ${r.ok ? "OK" : "**FALHOU**"} | ${r.s}s | ${r.note.replace(/\|/g, "/")} |`), "", `Total: ${results.filter((r) => r.ok).length}/${results.length} etapas OK`];
writeFileSync("docs/QA_RELATORIO.md", md.join("\n") + "\n");
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} OK`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
