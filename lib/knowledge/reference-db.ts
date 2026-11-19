// Reference database (Neon, hybrid architecture D-20): original-language words, lexicons, cross-references and verse
// numbering maps. Read-only role (REFERENCE_DATABASE_URL); no personal data lives here. Uses Neon's SQL-over-HTTP
// endpoint, so it works in serverless functions without a driver or a connection pool.
export async function refQuery<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.REFERENCE_DATABASE_URL;
  if (!url) throw new Error("reference_db_not_configured");
  const host = new URL(url).host;
  const res = await fetch(`https://${host}/sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Neon-Connection-String": url },
    body: JSON.stringify({ query: text, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`reference_db_${res.status}`);
  const j = (await res.json()) as { fields: { name: string }[]; rows: unknown[][] | Record<string, unknown>[] };
  return j.rows.map((r) => (Array.isArray(r) ? Object.fromEntries(j.fields.map((f, i) => [f.name, r[i]])) : r)) as T[];
}
