// Server-side auth for /api/v1 routes: the token comes in the Authorization header (never a cookie, spec 10.6.3).
// Data is read and written with a Supabase client carrying the USER's token, so Row Level Security applies to every query.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export interface AuthedContext {
  user: User;
  token: string;
  db: SupabaseClient;
}

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new HttpError(503, "supabase_not_configured");
  return { url, key };
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return /^Bearer\s+(.+)$/i.exec(h)?.[1] ?? null;
}

/** Anonymous client (public catalog only). */
export function anonClient(): SupabaseClient {
  const { url, key } = env();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(req: Request): Promise<AuthedContext> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "unauthorized");
  const { url, key } = env();
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");
  return { user: data.user, token, db };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.code }, { status: e.status });
  console.error(JSON.stringify({ evt: "api_error", code: (e as Error).message?.slice(0, 80) }));
  return Response.json({ error: "internal_error" }, { status: 500 });
}

/** Admin-only endpoints: the signed-in user must have role "admin" in profiles (the role cannot be self-assigned, see migration 0005). */
export async function requireAdmin(req: Request): Promise<AuthedContext> {
  const ctx = await requireUser(req);
  const { data } = await ctx.db.from("profiles").select("role").eq("user_id", ctx.user.id).maybeSingle();
  if (data?.role !== "admin") throw new HttpError(403, "forbidden");
  return ctx;
}
