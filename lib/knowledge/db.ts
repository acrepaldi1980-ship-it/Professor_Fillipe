// Thin database access for the knowledge base. The default implementation talks to Supabase over HTTPS
// (Management API), which works from sandboxes where direct Postgres connections are blocked.
// In production, swap for a pooled Postgres or PostgREST client behind the same interface.

export interface Db {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
}

/** Quote a string as a SQL literal. */
export const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
export const litArray = (a: string[]) => (a.length ? `array[${a.map(lit).join(",")}]::text[]` : "'{}'::text[]");
export const litVector = (v: number[]) => `'[${v.map((x) => x.toFixed(6)).join(",")}]'::vector`;

export class ManagementApiDb implements Db {
  constructor(
    private readonly projectRef = process.env.SUPABASE_PROJECT_REF ?? "hltyhkydytetdatgyvux",
    private readonly token = process.env.SUPABASE_ACCESS_TOKEN,
  ) {}

  async query<T>(sql: string): Promise<T[]> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`; // in the sandbox the proxy injects it
    const res = await fetch(`https://api.supabase.com/v1/projects/${this.projectRef}/database/query/read-only`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: sql }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`db_query_failed_${res.status}: ${body.slice(0, 300)}`);
    return JSON.parse(body) as T[];
  }
}

let db: Db | null = null;
export function getDb(): Db {
  db ??= new ManagementApiDb();
  return db;
}
