// Runs scripts/rls-test.sql and prints each check. Exit code 1 if any check fails.
import { readFileSync } from "node:fs";
import { sql } from "./db.mjs";

(async () => {
  try {
    await sql(readFileSync("scripts/rls-test.sql", "utf8"));
    console.log("unexpected: test did not roll back");
    process.exit(1);
  } catch (e) {
    const m = /RLS_RESULT:(\[.*\])/s.exec(String(e.message).replace(/\\n/g, " ").replace(/\\"/g, '"'));
    if (!m) {
      console.log("RLS test error:", String(e.message).slice(0, 600));
      process.exit(1);
    }
    const rows = JSON.parse(m[1]);
    for (const r of rows) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
    const failed = rows.filter((r) => !r.pass).length;
    console.log(`\n${rows.length - failed}/${rows.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
