// Server-side auth for /api/v1 routes: the token comes in the Authorization header (never a cookie, spec 10.6.3).
// Data is read and written with a Supabase client carrying the USER's token, so Row Level Security applies to every query.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { reportError } from "../telemetry/log";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    /** Extra fields for the client (e.g. which limit was reached and the plan that unlocks it). */
    public extra?: Record<string, unknown>,
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

/**
 * The signed-in user of a request. The token is verified LOCALLY against the project's public signing keys (ES256, JWKS cached by the client): no call to the auth server
 * on every request (it cost 100 to 300 ms each). The database checks the same signature on every query, so this is no weaker than before; a token of a user deleted a
 * moment ago is accepted only until it expires (1 hour). Use `requireUserStrict` where that must not happen (administration).
 */
export async function requireUser(req: Request): Promise<AuthedContext> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "unauthorized");
  const { url, key } = env();
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await db.auth.getClaims(token);
    const c = data?.claims as { sub?: string; email?: string; role?: string; aud?: string | string[]; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | undefined;
    // a key of the project (role "anon") is a valid token too, but it is not a person
    if (!error && c?.sub && c.role === "authenticated") {
      return { user: { id: c.sub, email: c.email, aud: String(c.aud ?? "authenticated"), app_metadata: c.app_metadata ?? {}, user_metadata: c.user_metadata ?? {}, created_at: "" } as User, token, db };
    }
  } catch {
    /* fall back to asking the auth server */
  }
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");
  return { user: data.user, token, db };
}

/** Like `requireUser`, but asks the auth server: a deleted or banned user is refused at once. For administration and account-level changes. */
export async function requireUserStrict(req: Request): Promise<AuthedContext> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "unauthorized");
  const ctx = await requireUser(req);
  const { data, error } = await ctx.db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");
  return { ...ctx, user: data.user };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    if (e.status >= 500) reportError("api", e.code, e.status);
    return Response.json({ error: e.code, ...(e.extra ?? {}) }, { status: e.status, headers: e.status === 429 && typeof e.extra?.retryAfterSeconds === "number" ? { "Retry-After": String(e.extra.retryAfterSeconds) } : undefined });
  }
  reportError("api", (e as Error).message ?? "unknown", 500);
  return Response.json({ error: "internal_error" }, { status: 500 });
}

/** Admin-only endpoints: the signed-in user must have role "admin" in profiles (the role cannot be self-assigned, see migration 0005). */
export async function requireAdmin(req: Request): Promise<AuthedContext> {
  const ctx = await requireUserStrict(req);
  const { data } = await ctx.db.from("profiles").select("role").eq("user_id", ctx.user.id).maybeSingle();
  if (data?.role !== "admin") throw new HttpError(403, "forbidden");
  return ctx;
}

/** Reviewers (conselho teológico) and admins; returns the role so callers can apply the workflow rules. */
export async function requireReviewer(req: Request): Promise<AuthedContext & { role: "reviewer" | "admin" }> {
  const ctx = await requireUserStrict(req);
  const { data } = await ctx.db.from("profiles").select("role").eq("user_id", ctx.user.id).maybeSingle();
  if (data?.role !== "admin" && data?.role !== "reviewer") throw new HttpError(403, "forbidden");
  return { ...ctx, role: data.role };
}
