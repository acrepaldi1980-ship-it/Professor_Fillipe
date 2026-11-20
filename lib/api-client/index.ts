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
  profile: { first_topic?: string | null; level?: string | null; level_score?: number | null; goals?: string[]; preferred_formats?: string[]; daily_minutes?: number | null; display_name: string | null; preferred_name: string | null; birth_date: string | null; is_minor: boolean; ui_prefs: Record<string, unknown>; role: string } | null;
  consents: Record<string, { granted: boolean; version: string }>;
  termsVersion: string;
  onboarding: { needsConsent: boolean; needsReligiousChoice: boolean; needsInterview: boolean };
}

export const getMe = () => apiJson<MeResponse>("/me");
export const saveMe = (body: Record<string, unknown>) => apiJson<{ ok: true }>("/me", { method: "PUT", body: JSON.stringify(body) });
export const saveConsent = (kind: string, granted: boolean) => apiJson<{ ok: true }>("/consents", { method: "POST", body: JSON.stringify({ kind, granted }) });
export const createSession = (mode = "free", context?: Record<string, unknown>) => apiJson<{ sessionId: string }>("/sessions", { method: "POST", body: JSON.stringify({ mode, context }) });
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
export interface BibleVersionInfo { id: string; name: string; abbreviation: string; language: string; audience: string }
export const getLenses = () => apiJson<{ lenses: string[]; available: string[]; versions: BibleVersionInfo[]; main_version_id: string; compare_version_ids: string[] }>("/preferences");
export const saveVersions = (main_version_id: string, compare_version_ids: string[]) => apiJson<{ ok: boolean }>("/preferences", { method: "PUT", body: JSON.stringify({ main_version_id, compare_version_ids }) });
export const saveLensesApi = (lenses: string[]) => apiJson<{ ok: boolean }>("/preferences", { method: "PUT", body: JSON.stringify({ lenses }) });

// ---- Interview, level and settings (Prompt 1.7) ----
export interface InterviewAnswers {
  preferred_name: string;
  study_experience: "starting" | "lt_2y" | "2_10y" | "gt_10y";
  goals: string[];
  ministry_role?: string;
  teaching_age_group?: string;
  daily_minutes: number;
  preferred_formats: string[];
  first_topic: string;
}
export const submitInterview = (a: InterviewAnswers) => apiJson<{ score: number; level: "iniciante" | "intermediário" | "avançado" }>("/me/interview", { method: "POST", body: JSON.stringify(a) });
export const getLevel = () => apiJson<{ level: string; suggestion: string | null }>("/me/level");
export const setLevel = (level: string) => apiJson<{ ok: boolean }>("/me/level", { method: "POST", body: JSON.stringify({ level }) });

// ---- Guided modes: live document and PDF (Prompt 1.8) ----
export interface SessionDocument { mode: "free" | "lesson" | "sermon" | "deep" | string; context: Record<string, unknown>; doc: Record<string, unknown> | null; gaps: string[] }
export const getSessionDocument = (sessionId: string) => apiJson<SessionDocument>(`/sessions/${sessionId}/document`);
export const saveSessionDocument = (sessionId: string, patch: Record<string, unknown>) => apiJson<{ ok: boolean }>(`/sessions/${sessionId}/document`, { method: "PUT", body: JSON.stringify({ patch }) });
export const getSermonTypes = () => apiJson<{ types: { name: string; definition: string }[] }>("/sermon-types");
export async function downloadSessionPdf(sessionId: string): Promise<void> {
  const res = await apiFetch(`/sessions/${sessionId}/pdf`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  const cd = res.headers.get("Content-Disposition") ?? "";
  await getPlatform().files.save(/filename="([^"]+)"/.exec(cd)?.[1] ?? "documento.pdf", await res.blob());
}

// ---- Visuals: maps and timelines (Prompt 1.9) ----
export async function getMapRoute(id: string): Promise<{ id: string; name: string; steps: { text: string; steps: import("@/lib/visuals/route-data").RouteStep[] }; sources: string[] }> {
  return (await apiJson<{ route: { id: string; name: string; steps: { text: string; steps: import("@/lib/visuals/route-data").RouteStep[] }; sources: string[] } }>(`/visuals/maps?id=${encodeURIComponent(id)}`)).route;
}
export async function getTimeline(id: string): Promise<{ id: string; name: string; events: import("@/lib/visuals/timeline-data").TimelineEvent[] }> {
  return (await apiJson<{ timeline: { id: string; name: string; events: import("@/lib/visuals/timeline-data").TimelineEvent[] } }>(`/visuals/timelines?id=${encodeURIComponent(id)}`)).timeline;
}
export async function listVisuals(): Promise<{ maps: { id: string; name: string }[]; timelines: { id: string; name: string }[]; models: { id: string; name: string }[] }> {
  const [m, t, d] = await Promise.all([apiJson<{ routes: { id: string; name: string }[] }>("/visuals/maps"), apiJson<{ timelines: { id: string; name: string }[] }>("/visuals/timelines"), apiJson<{ models: { id: string; name: string }[] }>("/visuals/models")]);
  return { maps: m.routes, timelines: t.timelines, models: d.models };
}

export type IllustrationResult = { status: "ok"; hash: string; alt: string } | { status: "refused" | "limit" | "unavailable" };
export async function requestIllustration(prompt: string, alt?: string): Promise<IllustrationResult> {
  const res = await apiFetch("/visuals/illustration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, alt }) });
  const body = (await res.json().catch(() => ({ status: "unavailable" }))) as IllustrationResult;
  if (res.status === 401) throw new Error("api_error_401");
  return body;
}
export async function getIllustrationBlob(hash: string): Promise<Blob> {
  const res = await apiFetch(`/visuals/illustration/${hash}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.blob();
}

// ---- Closing, review and notebook (Prompt 1.10) ----
import type { MindMapData } from "@/components/review/MindMapView";
export interface ClosingData { summary: string; mind_map: MindMapData; topics: string[]; cards: { id: string; question: string; answer: string; ref: string | null }[] }
export const closeSessionFull = (sessionId: string) => apiJson<{ ok: boolean; closed: boolean; cards?: number }>(`/sessions/${sessionId}/close`, { method: "POST" });
export const getClosing = (sessionId: string) => apiJson<ClosingData>(`/sessions/${sessionId}/closing`);
export interface DueCard { id: string; question: string; ref: string | null }
export const getDueCards = (limit = 10) => apiJson<{ cards: DueCard[]; total: number }>(`/review/due?limit=${limit}`);
export const gradeCard = (cardId: string, answer: string) => apiJson<{ verdict: "wrong" | "partial" | "right"; feedback: string; expected: string; nextInDays: number }>("/review/grade", { method: "POST", body: JSON.stringify({ cardId, answer }) });
export interface NotebookEntry { id: string; kind: string; title: string; snippet: string; date: string; books: string[]; sessionId?: string; ref?: string }
export const getNotebook = (q = "", book = "", kind = "") => apiJson<{ items: NotebookEntry[] }>(`/notebook?q=${encodeURIComponent(q)}&book=${book}&kind=${kind}`);
export const addNote = (title: string, text: string, book?: string) => apiJson<{ id: string }>("/notebook/notes", { method: "POST", body: JSON.stringify({ title, text, book }) });
export const deleteNote = (id: string) => apiJson<{ ok: boolean }>(`/notebook/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
export const addBookmark = (ref: string, versionId: string) => apiJson<{ ok: boolean }>("/notebook/bookmarks", { method: "POST", body: JSON.stringify({ ref, version_id: versionId }) });
export async function exportNotebook(id = "all"): Promise<void> {
  const res = await apiFetch(`/notebook/export?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  await getPlatform().files.save(id === "all" ? "meu-caderno.pdf" : "item-do-caderno.pdf", await res.blob());
}
export interface SessionRow { id: string; mode: string; topic: string | null; started_at: string; ended_at: string | null }
export const getRecentSessions = (limit = 5) => apiJson<{ sessions: SessionRow[] }>(`/sessions?limit=${limit}`);
