// Builds the app screens as a static export (what Capacitor will package) in a temp copy WITHOUT the API routes.
// If any screen depends on the Next.js server, this build fails (spec 10.6.1).
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const dir = ".static-build";
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir);
for (const f of ["app", "components", "lib", "public", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "package.json", "next-env.d.ts"]) {
  if (existsSync(f)) cpSync(f, `${dir}/${f}`, { recursive: true });
}
rmSync(`${dir}/app/api`, { recursive: true, force: true }); // the API lives on the server, not in the app bundle
symlinkSync(process.cwd() + "/node_modules", `${dir}/node_modules`);
const r = spawnSync("npx", ["next", "build"], { cwd: dir, stdio: "inherit", env: { ...process.env, NEXT_STATIC: "1" } });
rmSync(dir, { recursive: true, force: true });
if (r.status !== 0) {
  console.error("Static build FAILED: some screen depends on the server.");
  process.exit(1);
}
console.log("Static build passed.");
