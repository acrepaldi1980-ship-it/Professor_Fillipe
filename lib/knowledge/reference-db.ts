// Reference database (Neon, hybrid architecture D-20): original-language words, lexicons, cross-references and verse
// numbering maps. Read-only role (REFERENCE_DATABASE_URL); no personal data lives here. Uses Neon's SQL-over-HTTP
// endpoint, so it works in serverless functions without a driver or a connection pool.
/** Connection strings of every library shard: REFERENCE_DATABASE_URL (the main one: lexicons, graph, Josephus...) and REFERENCE_DATABASE_URL_2, _3... (more room for library chunks). */
export function shardUrls(env: Record<string, string | undefined> = process.env): string[] {
  return [env.REFERENCE_DATABASE_URL, ...[2, 3, 4, 5, 6].map((n) => env[`REFERENCE_DATABASE_URL_${n}`])].filter((u): u is string => !!u);
}

export async function refQuery<T = Record<string, unknown>>(text: string, params: unknown[] = [], urlOverride?: string): Promise<T[]> {
  const url = urlOverride ?? process.env.REFERENCE_DATABASE_URL;
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
