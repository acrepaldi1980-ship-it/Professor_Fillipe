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

// ---- Teacher, voice and Bible endpoints (spec 10.5) ----
import type { TeacherResponse } from "@/lib/teacher/schema";

export interface TurnMeta {
  intent: string;
  tier: string;
  words: number;
  latencyMs: number;
  /** Id of the saved teacher message (absent for pastoral turns, which store nothing). */
  messageId?: string;
}

/** One teacher turn over SSE. Calls onStructured once with the validated contract. */
export async function teacherTurn(
  body: { sessionId: string; text: string; intent?: string },
  signal?: AbortSignal,
): Promise<{ response: TeacherResponse; meta: TurnMeta }> {
  const res = await apiFetch("/teacher/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`api_error_${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let response: TeacherResponse | null = null;
  let meta: TurnMeta | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (!event || !data) continue;
      if (event === "structured") response = JSON.parse(data);
      else if (event === "done") meta = JSON.parse(data);
      else if (event === "error") throw new Error("turn_failed");
    }
  }
  if (!response) throw new Error("turn_failed");
  return { response, meta: meta ?? { intent: "ask", tier: "fast", words: 0, latencyMs: 0 } };
}

export async function transcribeAudio(audio: Blob): Promise<{ text: string; confidence?: number }> {
  const form = new FormData();
  form.set("audio", audio, "audio.webm");
  const res = await apiFetch("/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json();
}

export async function speakSentence(text: string, signal?: AbortSignal): Promise<Blob> {
  const res = await apiFetch("/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.blob();
}

export async function getBibleVerses(version: string, ref: string) {
  return apiJson<{ version: string; ref: string; verses: { ref: string; text: string }[] }>(`/bible/${version}/${ref}`);
}

// ---- Account, profile and sessions ----
export interface MeResponse {
  user: { id: string; email?: string };
  profile: { display_name: string | null; preferred_name: string | null; birth_date: string | null; is_minor: boolean; ui_prefs: Record<string, unknown>; role: string } | null;
  consents: Record<string, { granted: boolean; version: string }>;
  termsVersion: string;
  onboarding: { needsConsent: boolean; needsReligiousChoice: boolean };
}

export const getMe = () => apiJson<MeResponse>("/me");
export const saveMe = (body: Record<string, unknown>) => apiJson<{ ok: true }>("/me", { method: "PUT", body: JSON.stringify(body) });
export const saveConsent = (kind: string, granted: boolean) => apiJson<{ ok: true }>("/consents", { method: "POST", body: JSON.stringify({ kind, granted }) });
export const createSession = (mode = "free") => apiJson<{ sessionId: string }>("/sessions", { method: "POST", body: JSON.stringify({ mode }) });
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch("/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "EXCLUIR" }) });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
}
export const getConfig = () => apiJson<{ minVersion: string; flags: Record<string, boolean> }>("/config");

export interface SourceWork {
  id: string;
  title: string;
  authors: string[];
  pub_year: number | null;
  language: string;
  kind: string;
  tradition: string;
  license: string;
  credit_text: string | null;
  source_url: string | null;
}

export async function getSources(): Promise<SourceWork[]> {
  return (await apiJson<{ works: SourceWork[] }>("/sources")).works;
}

export interface LibraryAdminReport {
  works: { total: number; byKind: { name: string; works: number }[]; byTradition: { name: string; works: number }[]; byLanguage: { name: string; works: number }[]; byLicense: { name: string; works: number }[] };
  libraryChunks: { kind: string; tradition: string; n: number }[];
  review: { total: number; items: { id: string; title: string; authors: string; reason: string }[] };
}

export async function getLibraryAdminReport(): Promise<LibraryAdminReport> {
  return apiJson<LibraryAdminReport>("/admin/library");
}

// ---- Own notes review (Prompt 1.4, spec 8.11) ----
export type NoteStatus = "draft" | "in_review" | "approved" | "published";
export interface NoteListItem { id: string; kind: string; book_code: string | null; ref_range: string | null; title: string; status: NoteStatus; originality_score: number | null; rewrite_count: number; updated_at: string }
export interface NoteDetail extends NoteListItem {
  body: string;
  sources: { type: string; id: string; label: string }[];
  originality_report: { threshold: number; maxSimilarity: number; rewrites: number; paragraphs: { index: number; ngram: number; cosine: number; similarity: number; source: string | null; flagged: boolean }[] } | null;
}
export interface NoteComment { id: string; user_id: string; body: string; created_at: string }

export const listNotes = (status?: NoteStatus) => apiJson<{ role: "reviewer" | "admin"; items: NoteListItem[] }>(`/admin/notes${status ? `?status=${status}` : ""}`);
export const getNote = (id: string) => apiJson<{ role: "reviewer" | "admin"; note: NoteDetail; comments: NoteComment[] }>(`/admin/notes/${id}`);
export const patchNote = (id: string, body: { status?: NoteStatus; body?: string; title?: string }) => apiJson<{ ok: boolean; status: NoteStatus }>(`/admin/notes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const commentNote = (id: string, body: string) => apiJson<{ ok: boolean }>(`/admin/notes/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) });

export const flagAnswer = (messageId: string, reason?: string) => apiJson<{ ok: boolean }>("/teacher/flag", { method: "POST", body: JSON.stringify({ messageId, reason }) });
export const closeSession = (sessionId: string) => apiJson<{ ok: boolean; summarized: boolean }>(`/sessions/${sessionId}/close`, { method: "POST" });
export const getLenses = () => apiJson<{ lenses: string[]; available: string[] }>("/preferences");
export const saveLensesApi = (lenses: string[]) => apiJson<{ ok: boolean }>("/preferences", { method: "PUT", body: JSON.stringify({ lenses }) });
