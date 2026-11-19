// SQL against the Neon reference database over HTTPS (Neon's SQL-over-HTTP endpoint; works through the proxy).
// Uses NEON_OWNER_URL from .env.local (admin credential, local only; never deployed).
const url = process.env.NEON_OWNER_URL;
if (!url) throw new Error("NEON_OWNER_URL is not set (load .env.local)");
const host = new URL(url).host;

/** Runs one statement (use $1.. params) and returns the rows as objects. */
export async function nsql(text, params = []) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://${host}/sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Neon-Connection-String": url },
      body: JSON.stringify({ query: text, params }),
    });
    const body = await res.text();
    if (res.ok) {
      const j = JSON.parse(body);
      return (j.rows ?? []).map((r) => (Array.isArray(r) ? Object.fromEntries(j.fields.map((f, i) => [f.name, r[i]])) : r));
    }
    if (res.status >= 500 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`Neon SQL failed (${res.status}): ${body.slice(0, 600)}`);
  }
  throw new Error("Neon SQL failed after retries");
}
