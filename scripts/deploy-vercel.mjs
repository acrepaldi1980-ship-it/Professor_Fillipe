// Publishes the app to Vercel through the REST API (no Git connection needed): creates the project if missing,
// sets environment variables, uploads the tracked files and creates a production deployment.
// Secrets come from .env.local (never printed) and the Vercel token is injected by the network proxy.
// Usage: node scripts/deploy-vercel.mjs [--env-only] [--no-wait]
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const API = "https://api.vercel.com";
const NAME = process.env.VERCEL_PROJECT ?? "professor-filipe";
const H = { Authorization: "Bearer proxy-injected" };

const envFile = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

async function v(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${(json?.error?.message ?? text).slice(0, 300)}`);
  return json;
}
const post = (path, body, extra = {}) => v(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...extra });

async function ensureProject() {
  try {
    return await v(`/v9/projects/${NAME}`);
  } catch (e) {
    if (!/404/.test(e.message)) throw e;
    console.log("creating project", NAME);
    return post("/v11/projects", { name: NAME, framework: "nextjs" });
  }
}

async function setEnv(project) {
  // The encryption key for production is generated once and kept only in Vercel.
  const existing = await v(`/v9/projects/${project.id}/env`);
  const has = (k) => existing.envs.some((e) => e.key === k);
  const vars = [
    ["NEXT_PUBLIC_SUPABASE_URL", envFile.NEXT_PUBLIC_SUPABASE_URL, "plain"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", envFile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "plain"],
    ["NEXT_PUBLIC_APP_VERSION", "0.1.0", "plain"],
    ["GROQ_API_KEY", envFile.GROQ_API_KEY, "sensitive"],
    ["REFERENCE_DATABASE_URL", envFile.REFERENCE_DATABASE_URL, "sensitive"],
    ["TEACHER_LLM_PROVIDER", "groq", "plain"],
    ["TRANSFORMERS_CACHE_DIR", "/tmp/hf-cache", "plain"],
  ];
  if (!has("FIELD_ENCRYPTION_KEY")) vars.push(["FIELD_ENCRYPTION_KEY", randomBytes(32).toString("base64"), "sensitive"]);
  const body = vars.filter(([k, val]) => val && (!has(k) || k.startsWith("NEXT_PUBLIC") || k === "GROQ_API_KEY" || k === "REFERENCE_DATABASE_URL")).map(([key, value, type]) => ({ key, value, type, target: ["production", "preview"] }));
  await post(`/v10/projects/${project.id}/env?upsert=true`, body);
  console.log("env vars set:", body.map((b) => b.key).join(", "));
}

async function deploy() {
  const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => existsSync(f) && !f.startsWith("data/") && !f.startsWith("docs/") && !f.startsWith("evals/reports/") && !f.startsWith(".github/"));
  // The embedding model is bundled with the deployment (not in git: too large); see lib/knowledge/embeddings.ts.
  const extra = existsSync("models") ? execSync("find models -type f", { encoding: "utf8" }).split("\n").filter(Boolean) : [];
  const entries = [];
  for (const f of [...files, ...extra]) {
    const buf = readFileSync(f);
    const sha = createHash("sha1").update(buf).digest("hex");
    entries.push({ file: f, sha, size: buf.length });
    const res = await fetch(`${API}/v2/files`, { method: "POST", headers: { ...H, "x-vercel-digest": sha, "Content-Type": "application/octet-stream", "Content-Length": String(buf.length) }, body: buf });
    if (!res.ok && res.status !== 409) throw new Error(`upload ${f} -> ${res.status}`);
  }
  console.log("files uploaded:", entries.length);
  const d = await post("/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1", {
    name: NAME,
    project: NAME,
    target: "production",
    files: entries,
    projectSettings: { framework: "nextjs", nodeVersion: "22.x", installCommand: "npm install", buildCommand: "npm run build" },
  });
  console.log("deployment", d.id, d.url);
  return d;
}

async function wait(id) {
  for (let i = 0; i < 90; i++) {
    const d = await v(`/v13/deployments/${id}`);
    if (["READY", "ERROR", "CANCELED"].includes(d.readyState)) return d;
    if (i % 4 === 0) console.log("  state:", d.readyState);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("timeout waiting for deployment");
}

async function buildLog(id) {
  const ev = await v(`/v3/deployments/${id}/events?limit=-1`);
  return ev.filter((e) => e.type === "stdout" || e.type === "stderr").map((e) => e.payload?.text ?? "").filter(Boolean).slice(-40).join("\n");
}

(async () => {
  const project = await ensureProject();
  await setEnv(project);
  if (process.argv.includes("--env-only")) return;
  const d = await deploy();
  if (process.argv.includes("--no-wait")) return;
  const done = await wait(d.id);
  console.log("final state:", done.readyState);
  if (done.readyState !== "READY") {
    console.log(await buildLog(d.id));
    process.exit(1);
  }
  const aliases = (done.alias ?? []).filter(Boolean);
  console.log("URL:", aliases.length ? `https://${aliases[0]}` : `https://${done.url}`, "| all aliases:", aliases.join(", "));
})().catch((e) => { console.error("DEPLOY ERROR:", e.message); process.exit(1); });
