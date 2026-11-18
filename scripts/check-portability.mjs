// Fails when app code breaks the portability rules of spec 10.6 (so the app can be wrapped by Capacitor without rewrites).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const SKIP = ["lib/platform/", "app/api/", "node_modules", ".next"];

// Browser capabilities that must go through lib/platform.
const BROWSER_APIS = [
  [/navigator\.mediaDevices/, "microphone: use getPlatform().microphone"],
  [/new Audio\(/, "audio: use getPlatform().audioPlayer"],
  [/\bNotification\.(requestPermission|permission)/, "notifications: use getPlatform().push"],
  [/\b(local|session)Storage\b/, "storage: use getPlatform().store"],
  [/\bindexedDB\b/, "storage: use getPlatform().store"],
  [/navigator\.(share|clipboard)/, "sharing: use getPlatform().share"],
  [/createObjectURL[^;]*\n?[^;]*\.download\b|\.download\s*=/, "files: use getPlatform().files"],
  [/window\.location\.(assign|href\s*=)/, "navigation/checkout: use getPlatform().purchases or the router"],
];

// Server-only things that app screens (not api routes, not public pages) must not use.
const SERVER_ONLY = [
  [/from ["']next\/headers["']/, "cookies/headers are server-only (token goes in the Authorization header)"],
  [/["']use server["']/, "Server Actions are not available inside the native shell"],
  [/@\/lib\/knowledge\/(db|search)["']/, "screens must fetch through lib/api-client, never the database"],
  [/@\/lib\/teacher\/(deps|anthropic|groq|pipeline)["']/, "engine internals are server-only"],
  [/@supabase\/supabase-js|@supabase\/ssr/, "screens must go through lib/api-client"],
];
const PUBLIC_PAGES = ["app/(public)/"];

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (SKIP.some((s) => p.includes(s))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(p)) yield p;
  }
}

const problems = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    for (const [re, msg] of BROWSER_APIS) if (re.test(src)) problems.push(`${file}: ${msg}`);
    if (file.startsWith("app/") && !PUBLIC_PAGES.some((p) => file.startsWith(p))) {
      for (const [re, msg] of SERVER_ONLY) if (re.test(src)) problems.push(`${file}: ${msg}`);
    }
  }
}
if (problems.length) {
  console.error("Portability check FAILED:\n" + problems.map((p) => " - " + p).join("\n"));
  process.exit(1);
}
console.log("Portability check passed.");
