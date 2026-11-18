// Browser auth client (Supabase Auth). The session is kept through lib/platform (LocalStore), never cookies,
// so the same code works inside the Capacitor shell (spec 10.6.3). Screens use only the functions exported here.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { setAccessToken } from "@/lib/api-client";
import { getPlatform } from "@/lib/platform";

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_not_configured");
  client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: {
        getItem: async (k: string) => (await getPlatform().store.get<string>(k)) ?? null,
        setItem: async (k: string, v: string) => getPlatform().store.set(k, v),
        removeItem: async (k: string) => getPlatform().store.remove(k),
      },
    },
  });
  return client;
}

const redirectTo = () => `${window.location.origin}/auth/callback`;

export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw new Error(error.status === 429 ? "rate_limited" : "email_failed");
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) throw new Error("google_failed");
}

export async function signOut(): Promise<void> {
  await sb().auth.signOut();
  setAccessToken(null);
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await sb().auth.getSession();
  setAccessToken(data.session?.access_token ?? null);
  return data.session;
}

/** Keeps api-client's Bearer token in sync with the session (renewal is automatic). */
export function watchSession(cb: (s: Session | null) => void): () => void {
  const { data } = sb().auth.onAuthStateChange((_event, session) => {
    setAccessToken(session?.access_token ?? null);
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}
