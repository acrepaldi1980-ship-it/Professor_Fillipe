// The only path from app screens to data (spec 10.6.1). All routes live under /api/v1,
// authenticated with a Bearer token (no cookies), and every call sends X-App-Version / X-Platform.
import { getLanguage } from "@/lib/i18n";
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

/** An API error: the message stays `api_error_<status>`; `data` carries the body (e.g. {error:"limit", plan, upgrade}). */
export class ApiError extends Error {
  constructor(public status: number, public data: Record<string, unknown> = {}) {
    super(`api_error_${status}`);
  }
}
/** The student's plan limit was reached / the feature belongs to another plan: the screens then invite to subscribe. */
export const isPlanBlock = (e: unknown): e is ApiError => e instanceof ApiError && ((e.status === 429 && e.data.error === "limit") || (e.status === 403 && e.data.error === "plan_required"));

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = apiHeaders(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
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

/** Wakes the server parts a first question needs (search model, databases, voice) so the first answer is not slow. At most once every 8 minutes; never throws. */
let lastWarm = 0;
export function warmUp() {
  if (Date.now() - lastWarm < 8 * 60_000) return;
  lastWarm = Date.now();
  void fetch(`${API_BASE}/warmup`, { signal: AbortSignal.timeout(60000) }).catch(() => undefined);
}

/** One teacher turn over SSE. A turn that fails for a passing reason (server error, dropped connection, no answer in 50 s) is tried once more by itself:
 *  the student should get an answer, not an error to retry by hand. Errors that repeating cannot fix (login, plan limit, rate limit) come straight back. */
export async function teacherTurn(
  body: Parameters<typeof teacherTurnOnce>[0],
  signal?: AbortSignal,
  /** Called when the server finishes saving the answer (the message id arrives here, after the answer itself). */
  onDone?: (meta: TurnMeta) => void,
): Promise<{ response: TeacherResponse; meta: TurnMeta }> {
  const attempt = () => teacherTurnOnce(body, signal ? AbortSignal.any([signal, AbortSignal.timeout(50000)]) : AbortSignal.timeout(50000), onDone);
  try {
    return await attempt();
  } catch (e) {
    if (signal?.aborted) throw e;
    const status = e instanceof ApiError ? e.status : 0;
    const passing = status === 0 || status >= 500; // 0: network, timeout, "turn_failed"
    if (!passing) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return attempt();
  }
}

async function teacherTurnOnce(
  body: { sessionId: string; text: string; intent?: string; scene?: { env: string; x: number; z: number; yaw: number; hotspot?: string | null; station?: number | null }; pano?: { tour: string; scene: string; hotspot?: string | null; yaw?: number; pitch?: number } },
  signal?: AbortSignal,
  onDone?: (meta: TurnMeta) => void,
): Promise<{ response: TeacherResponse; meta: TurnMeta }> {
  const res = await apiFetch("/teacher/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // Resolves as soon as the answer ("structured") arrives; the rest of the stream (saving, "done" with the message id) is read in the background.
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (e: unknown) => { if (!settled) { settled = true; reject(e); } };
    (async () => {
      let response: TeacherResponse | null = null;
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
          if (event === "structured") {
            response = JSON.parse(data);
            if (!settled) { settled = true; resolve({ response: response!, meta: { intent: "ask", tier: "fast", words: 0, latencyMs: 0 } }); }
          } else if (event === "done") {
            const meta = JSON.parse(data) as TurnMeta;
            if (!settled && response) { settled = true; resolve({ response, meta }); }
            onDone?.(meta);
          } else if (event === "error" && !response) throw new Error("turn_failed");
        }
      }
      if (!response) throw new Error("turn_failed");
    })().catch(fail);
  });
}

export async function transcribeAudio(audio: Blob): Promise<{ text: string; confidence?: number }> {
  const form = new FormData();
  form.set("audio", audio, "audio.webm");
  form.set("lang", getLanguage() === "es" ? "es" : "pt");
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
  profile: { locale?: string; first_topic?: string | null; level?: string | null; level_score?: number | null; goals?: string[]; preferred_formats?: string[]; daily_minutes?: number | null; display_name: string | null; preferred_name: string | null; birth_date: string | null; is_minor: boolean; ui_prefs: Record<string, unknown>; role: string } | null;
  consents: Record<string, { granted: boolean; version: string }>;
  termsVersion: string;
  onboarding: { needsConsent: boolean; needsReligiousChoice: boolean; needsInterview: boolean };
}

export const getMe = () => apiJson<MeResponse>("/me");
export const saveMe = (body: Record<string, unknown>) => apiJson<{ ok: true }>("/me", { method: "PUT", body: JSON.stringify(body) });
export const saveConsent = (kind: string, granted: boolean) => apiJson<{ ok: true }>("/consents", { method: "POST", body: JSON.stringify({ kind, granted }) });
export const createSession = (mode = "free", context?: Record<string, unknown>, churchLessonId?: string, trail?: { pathId: string; pathDay: number }) => apiJson<{ sessionId: string }>("/sessions", { method: "POST", body: JSON.stringify({ mode, context, churchLessonId, ...(trail ?? {}) }) });
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch("/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "EXCLUIR" }) });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
}
export async function exportMyData(): Promise<Blob> {
  const res = await apiFetch("/account/export");
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.blob();
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
export interface SessionDocument { mode: "free" | "lesson" | "sermon" | "deep" | string; context: Record<string, unknown>; doc: Record<string, unknown> | null; gaps: string[]; gapKeys?: string[] }
export const getSessionDocument = (sessionId: string) => apiJson<SessionDocument>(`/sessions/${sessionId}/document`);
export interface SuggestResult { doc: Record<string, unknown>; gaps: string[]; gapKeys: string[] }
export async function suggestDocumentSection(sessionId: string, section: string, instruction?: string): Promise<SuggestResult> {
  const res = await apiFetch(`/sessions/${sessionId}/document/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, instruction }) });
  if (!res.ok) throw new Error(`api_error_${res.status}`);
  return res.json();
}
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
export async function listVisuals(): Promise<{ maps: { id: string; name: string }[]; timelines: { id: string; name: string }[]; models: CatalogModel[]; themes: string[] }> {
  const [m, t, d] = await Promise.all([apiJson<{ routes: { id: string; name: string }[] }>("/visuals/maps"), apiJson<{ timelines: { id: string; name: string }[] }>("/visuals/timelines"), apiJson<{ models: CatalogModel[]; themes: string[] }>("/visuals/models")]);
  return { maps: m.routes, timelines: t.timelines, models: d.models, themes: d.themes };
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

// ---- Plans and billing (Prompt 1.11) ----
export interface PlanInfo { id: "free" | "plus" | "premium"; name: string; price_month: number | string; price_year: number | string | null; limits: Record<string, number | null>; features: Record<string, boolean | string | number> }
export const getPlans = () => apiJson<{ plans: PlanInfo[]; provider: string }>("/plans");
export interface MySubscription {
  plan: "free" | "plus" | "premium";
  limits: Record<string, number | null>;
  features: Record<string, boolean | string | number>;
  usage: { text_messages_day: number; voice_minutes_day: number; illustrations_day: number; lessons_month: number; deepen_month: number };
  subscription: { plan: string; status: string; cycle: "month" | "year"; periodEnd: string | null; trialEnd: string | null; canceledAt: string | null; paidAccess: boolean } | null;
  trialEligible: boolean;
  provider: string;
}
export const getMySubscription = () => apiJson<MySubscription>("/billing/subscription");
export const startCheckout = (plan: "plus" | "premium", cycle: "month" | "year", method: "pix" | "card" | "boleto") => apiJson<{ checkoutUrl: string; trial: boolean; amount: number }>("/billing/checkout", { method: "POST", body: JSON.stringify({ plan, cycle, method }) });
export const cancelMySubscription = () => apiJson<{ ok: boolean }>("/billing/cancel", { method: "POST" });
export const simulatePayment = (ref: string, event: "PAYMENT_CONFIRMED" | "PAYMENT_OVERDUE" | "SUBSCRIPTION_DELETED") => apiJson<{ ok: boolean; result: string }>("/billing/simulate", { method: "POST", body: JSON.stringify({ ref, event }) });
export interface BillingAdmin { by_plan_status: { plan_id: string; status: string; n: number }[]; mrr_brl: number; canceled_30d: number; users: number; ai_cost_30d_brl: number; ai_cost_per_user: { user_id: string; cost: number; messages: number }[] }
export const getBillingAdmin = () => apiJson<BillingAdmin>("/admin/billing");

// ---- Analytics (client side events) and admin (Prompt 1.12) ----
export function trackEvent(event: "visual_opened" | "first_lesson_started", props: Record<string, string | number | boolean> = {}): void {
  void apiJson("/events", { method: "POST", body: JSON.stringify({ event, props }) }).catch(() => undefined);
}

export interface AdminWork { id: string; title: string; authors: string[]; kind: string; tradition: string; license: string; language: string; enabled: boolean; review_status: string; chunk_count: number }
export const adminWorks = () => apiJson<{ works: AdminWork[] }>("/admin/works");
export const adminSetWork = (id: string, enabled: boolean) => apiJson<{ ok: boolean }>("/admin/works", { method: "PATCH", body: JSON.stringify({ id, enabled }) });
export interface AdminFlag { flag_id: string; message_id: string; reason: string | null; status: "open" | "correct" | "incorrect"; created_at: string; question: string | null; answer: string; citations: unknown; reviewer_note: string | null; audit_sample: boolean }
export const adminFlags = (status = "open") => apiJson<{ flags: AdminFlag[] }>(`/admin/flags?status=${status}`);
export const adminReviewFlag = (id: string, status: "open" | "correct" | "incorrect", note: string) => apiJson<{ ok: boolean }>("/admin/flags", { method: "PATCH", body: JSON.stringify({ id, status, note }) });
export interface AdminUser { user_id: string; email: string; name: string | null; role: string; level: string | null; created_at: string; plan: string; sub_status: string | null; last_day: string | null; messages_30d: number }
export const adminUsers = (q = "") => apiJson<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`);
export const adminPayments = (userId: string) => apiJson<{ payments: { at: string; provider: string; event_type: string; ref: string | null }[] }>(`/admin/users?payments=${userId}`);
export const adminSetRole = (userId: string, role: "student" | "reviewer") => apiJson<{ ok: boolean }>("/admin/users", { method: "PATCH", body: JSON.stringify({ userId, role }) });
export interface AdminMetrics { users: number; dau: number; mau: number; interview_completion: number | null; sessions_per_user_week: number; retention: { d1: number | null; d7: number | null; d30: number | null }; conversion_pct: number | null; voice_latency_ms: { median: number; p95: number } | null; answers_30d: number; flagged_rate_pct: number | null; flags_open: number; last_eval: { ran_at: string; summary: Record<string, number | string> } | null; events_7d: { event: string; n: number }[]; billing: BillingAdmin; errors_24h?: { route: string; code: string; n: number; last_hour: string }[]; llm?: { endpoints: { id: string; calls: number; ok: number; rate_limited: number; quota: number; auth: number; errors: number; avg_ms: number }[]; cooling: { id: string; seconds: number; reason: string }[] } }
export const adminMetrics = () => apiJson<AdminMetrics>("/admin/metrics");
export interface AdminSettings { plans: { id: string; name: string; price_month: number | string; price_year: number | string | null; limits: Record<string, number | null>; features: Record<string, boolean | string | number>; active: boolean }[]; sermonTypes: { id: string; name: string; definition: string; enabled: boolean }[]; prompts: { layer: string; version: number; active: boolean; created_at: string; content: string }[] }
export const adminSettings = () => apiJson<AdminSettings>("/admin/settings");
export const adminSaveSetting = (body: Record<string, unknown>) => apiJson<{ ok: boolean; version?: number }>("/admin/settings", { method: "PUT", body: JSON.stringify(body) });
export const adminAudit = () => apiJson<{ entries: { at: string; actor: string | null; action: string; target: string | null; details: unknown }[] }>("/admin/audit");

// ---- Plano Igreja (Prompt 2.2) ----
export interface ChurchClass { id: string; name: string; age_group: string; teacher_id: string; archived: boolean; invite_code: string | null; students: number; mine: boolean }
export interface MyChurch { id: string; name: string; role: "admin" | "teacher" | "student"; plan_id: string; status: "pending" | "active" | "suspended"; student_limit: number; students: number; teacher_code: string | null; classes: ChurchClass[] }
export interface ChurchLesson { id: string; title: string; ref: string | null; date: string; notes: string | null; class: string; church: string; church_id: string }
export interface ClassStats { members: number; enough: boolean; min: number; studied: number | null; topics: { topic: string; students: number }[] }
const churchJson = <T,>(path: string, init?: RequestInit) => apiJson<T>(`/church${path}`, init);
export const getMyChurches = () => churchJson<{ churches: MyChurch[] }>("");
export const createChurch = (name: string, plan: string, cnpj?: string) => churchJson<{ id: string }>("", { method: "POST", body: JSON.stringify({ name, plan, cnpj }) });
export const createClass = (churchId: string, name: string, ageGroup: string, teacherId?: string) => churchJson<{ id: string }>("/classes", { method: "POST", body: JSON.stringify({ churchId, name, ageGroup, teacherId }) });
export const joinChurch = (code: string) => churchJson<{ role: "student" | "teacher"; church: string; class?: string; church_id: string }>("/join", { method: "POST", body: JSON.stringify({ code }) });
export async function leaveChurch(churchId: string): Promise<void> { const r = await apiFetch("/church/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churchId }) }); if (!r.ok) throw new Error(`api_error_${r.status}`); }
export async function saveChurchSettings(churchId: string, lenses: string[], versionId: string | null): Promise<void> { const r = await apiFetch("/church/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ churchId, lenses, versionId }) }); if (!r.ok) throw new Error(`api_error_${r.status}`); }
export const getMyLessons = () => churchJson<{ lessons: ChurchLesson[] }>("/lessons");
export const getClassLessons = (classId: string) => churchJson<{ lessons: { id: string; title: string; ref: string | null; date: string; notes: string | null }[] }>(`/lessons?classId=${encodeURIComponent(classId)}`);
export const publishLesson = (classId: string, title: string, ref?: string, date?: string, notes?: string) => churchJson<{ id: string }>("/lessons", { method: "POST", body: JSON.stringify({ classId, title, ref, date, notes }) });
export async function deleteLesson(id: string): Promise<void> { const r = await apiFetch(`/church/lessons?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (!r.ok) throw new Error(`api_error_${r.status}`); }
export const getClassStats = (classId: string, lessonId?: string) => churchJson<ClassStats>(`/stats?classId=${encodeURIComponent(classId)}${lessonId ? `&lessonId=${encodeURIComponent(lessonId)}` : ""}`);
export const startChurchCheckout = (churchId: string, cycle: "month" | "year", method: "pix" | "card" | "boleto") => churchJson<{ checkoutUrl: string; amount: number; plan: string }>("/checkout", { method: "POST", body: JSON.stringify({ churchId, cycle, method }) });

// ---- Aprofundar avançado (Prompt 2.3) ----
export interface MorphPt { pos: string; detail: string; text: string }
export interface IlWord { ref: string; position: number; surface: string; lemma: string | null; strong: string | null; translit: string | null; gloss: string | null; morph: string | null; morphPt: MorphPt | null; lang: "grc" | "heb" }
export const getInterlinear = (ref: string) => apiJson<{ ref: string; source: string; verses: { ref: string; words: IlWord[] }[] }>(`/study/interlinear/${encodeURIComponent(ref)}`);
export interface WordStudyData { strong: string; lemma: string | null; lang: "grc" | "heb"; occurrences: number; senses: { gloss: string; n: number }[]; entries: { source: string; definition: string }[]; sample: { ref: string; surface: string; gloss: string | null }[]; versions: string[]; renderings: { ref: string; texts: Record<string, string | null> }[]; source: string }
export const getWordStudy = (strong: string, versions?: string[]) => apiJson<WordStudyData>(`/study/word/${encodeURIComponent(strong)}${versions?.length ? `?versions=${versions.join(",")}` : ""}`);
export interface CompareData { ref: string; versions: string[]; verses: { ref: string; base: { version: string; text: string }; others: { version: string; text: string | null; segments: { text: string; changed: boolean }[] | null }[] }[] }
export const compareVersions = (ref: string, versions: string[]) => apiJson<CompareData>(`/study/compare?ref=${encodeURIComponent(ref)}&versions=${versions.join(",")}`);
export const explainVersions = (ref: string, versions: string[]) => apiJson<{ summary: string; points: { difference: string; reason: string }[]; source: string }>("/study/compare/explain", { method: "POST", body: JSON.stringify({ ref, versions }) });

// ---- Ensaio do sermão (spec 8.7.5) ----
export interface RehearsalPartTime { key: string; label: string; seconds: number | null; words: number | null; found: boolean }
export interface RehearsalMetrics {
  total_seconds: number; speaking_seconds: number; words: number; wpm: number; wpm_overall: number;
  pauses: { count: number; longest_seconds: number; total_seconds: number };
  crutches: { word: string; count: number; per_100_words: number; flagged: boolean }[];
  parts?: RehearsalPartTime[]; planned_minutes?: number | null;
}
export interface RehearsalFeedback {
  central_idea?: { stated_early: boolean; clarity: number; comment: string };
  transitions?: { score: number; comment: string };
  illustrations?: { used: string[]; comment: string };
  fidelity?: { score: number; comment: string; issues: string[] };
  strengths?: string[]; improvements?: { what: string; how: string }[];
}
export interface Rehearsal { id: string; created_at: string; duration_s: number; metrics: RehearsalMetrics; feedback: RehearsalFeedback; has_audio?: boolean; feedback_ok?: boolean; transcript?: string; analysis_ms?: number; audio_link?: string | null }
export const listRehearsals = (sessionId: string) => apiJson<{ items: Rehearsal[] }>(`/study/rehearsals?session_id=${encodeURIComponent(sessionId)}`);
export const getRehearsal = (id: string) => apiJson<Rehearsal>(`/study/rehearsals?id=${encodeURIComponent(id)}`);
export const deleteRehearsal = (id: string) => apiJson<{ ok: true }>(`/study/rehearsals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
export async function analyzeRehearsal(sessionId: string, audio: Blob, keep: boolean): Promise<Rehearsal> {
  const form = new FormData();
  form.set("audio", audio, `rehearsal.${audio.type.includes("mp4") ? "m4a" : "webm"}`);
  form.set("session_id", sessionId);
  if (keep) form.set("keep", "1");
  const res = await apiFetch("/study/rehearsals", { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

// ---- 3D model catalog (Prompt 2.6) ----
export interface CatalogModel { id: string; name: string; alt: string; theme: string; source: "code" | "upload"; size_bytes?: number | null }
export interface RemoteModel3D { id: string; name: string; alt: string; note: string; theme: string; refs: string[]; camera: [number, number, number]; hotspots: { id: string; label: string; text: string; refs: string[]; at: [number, number, number] }[]; license: string | null; sources: string[]; file_url: string | null; size_bytes: number | null; active?: boolean }
export const getModel3d = (id: string) => apiJson<{ model: RemoteModel3D }>(`/visuals/models?id=${encodeURIComponent(id)}`).then((r) => r.model);
export const adminModels3d = () => apiJson<{ models: RemoteModel3D[]; builtin: { id: string; name: string }[] }>("/visuals/models?admin=1");
export async function saveModel3d(meta: Record<string, unknown>, file?: File | null): Promise<{ ok: true; id: string }> {
  const form = new FormData();
  form.set("meta", JSON.stringify(meta));
  if (file) form.set("file", file, file.name);
  const res = await apiFetch("/visuals/models", { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}
export const deleteModel3d = (id: string) => apiJson<{ ok: true }>(`/visuals/models?id=${encodeURIComponent(id)}`, { method: "DELETE" });

// ---- Guided paths and study streak (Prompt 2.7) ----
export interface PathSummary { id: string; title: string; description: string; level: string; total: number; done: number; started: boolean; completed: boolean; next_day: { day: number; title: string } | null }
export interface PathDetail extends PathSummary { days: { day: number; title: string; ref: string; goal: string; done: boolean }[] }
export interface StreakData { current: number; best: number; total_days: number; studied_today: boolean; new_milestones: string[] }
export const listPaths = () => apiJson<{ paths: PathSummary[] }>("/study/paths");
export const getPathDetail = (id: string) => apiJson<PathDetail>(`/study/paths/${encodeURIComponent(id)}`);
export const startPath = (pathId: string) => apiJson<{ ok: true }>("/study/paths/start", { method: "POST", body: JSON.stringify({ pathId }) });
export const completePathDay = (pathId: string, day: number) => apiJson<{ ok: true; done: number; total: number; completed: boolean; milestone: string | null }>("/study/paths/day", { method: "POST", body: JSON.stringify({ pathId, day }) });
export const getStreak = (ack = false) => apiJson<StreakData>(`/study/streak?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo")}${ack ? "&ack=1" : ""}`);

// ---- Referral (Prompt 2.7) ----
export interface ReferralStatus { code: string; pending: number; rewarded: number; days_earned: number; max_rewards: number; referred_by_pending: boolean; settled: { settled?: boolean; friend_days?: number; referrer_days?: number; days_needed?: number } }
export const getReferral = () => apiJson<ReferralStatus>("/study/referral");
export const claimReferral = (code: string) => apiJson<{ result: string }>("/study/referral/claim", { method: "POST", body: JSON.stringify({ code }) });

// ---- Notifications (spec 8.15) ----
export interface NotificationPrefs { enabled: boolean; hour: number; tz: string; lang: string; kinds: { review: boolean; path: boolean; lesson: boolean; trial: boolean }; devices: number; vapid_public_key: string | null }
export const getNotificationPrefs = () => apiJson<NotificationPrefs>("/study/notifications");
export const saveNotificationPrefs = (p: Partial<Pick<NotificationPrefs, "enabled" | "hour" | "tz" | "lang" | "kinds">>) => apiJson<{ ok: true }>("/study/notifications", { method: "PUT", body: JSON.stringify(p) });
export const registerPushDevice = (subscription: unknown, platform: "web" | "ios" | "android" = "web") => apiJson<{ ok: true }>("/study/notifications/subscribe", { method: "POST", body: JSON.stringify({ subscription, platform }) });

// ---- Immersive environments published from /admin (Prompt 3.4) ----
export interface EnvListItem { id: string; title: string; era: string; size_bytes: number; source: "code" | "upload" }
export interface EnvAdminRow { id: string; title: string; status: "draft" | "published"; size_bytes: number; reports: Record<string, { ok: boolean; bytes: number; triangles: number; images: { width: number | null; height: number | null }[]; problems: string[] }>; updated_at: string; data: unknown }
export const listEnvironments = () => apiJson<{ environments: EnvListItem[] }>("/study/environments").then((r) => r.environments);
export const getEnvironment = (id: string) => apiJson<{ package: unknown; source: string; status?: string }>(`/study/environments?id=${encodeURIComponent(id)}`);
export const adminEnvironments = () => apiJson<{ environments: EnvAdminRow[]; limits: { maxBytes: number; maxTriangles: number; maxTexture: number; maxImages: number } }>("/study/environments?admin=1");
export async function saveEnvironment(pkg: unknown, status: "draft" | "published", files: Record<string, File>): Promise<{ ok: true; id: string; size_bytes: number }> {
  const form = new FormData();
  form.set("meta", JSON.stringify({ package: pkg, status }));
  for (const [zone, f] of Object.entries(files)) form.set(`glb:${zone}`, f, f.name);
  const res = await apiFetch("/study/environments", { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}
export const deleteEnvironment = (id: string) => apiJson<{ ok: true }>(`/study/environments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
