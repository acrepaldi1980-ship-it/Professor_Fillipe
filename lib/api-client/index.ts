// The only path from app screens to data (spec 10.6.1). All routes live under /api/v1,
// authenticated with a Bearer token (no cookies), and every call sends X-App-Version / X-Platform.
import { getPlatform } from "@/lib/platform";

export const API_BASE = "/api/v1";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function apiHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("X-App-Version", APP_VERSION);
  h.set("X-Platform", getPlatform().name);
  if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
  return h;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, { ...init, headers: apiHeaders(init.headers) });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = apiHeaders(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return (await res.json()) as T;
}
