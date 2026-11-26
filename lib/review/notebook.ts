// Notebook (RF-M09-04): one list that merges what the student produced: session closings, lesson plans, sermon outlines, deepening
// studies, bookmarked verses and personal notes. Filters by theme (search), Bible book and kind.
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotebookKind = "session" | "lesson" | "sermon" | "deep" | "bookmark" | "note" | "verse_note";
export interface NotebookEntry {
  id: string;
  kind: NotebookKind;
  title: string;
  snippet: string;
  date: string;
  books: string[];
  /** Where it opens: a session (conversation or document) or nothing for notes and verses. */
  sessionId?: string;
  ref?: string;
}

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);
const booksOf = (refs: string[]) => [...new Set(refs.map((r) => r.split(".")[0]).filter((b) => /^[0-9A-Z]{3}$/.test(b)))];
const refsIn = (text: string) => text.match(/\b[0-9A-Z]{3}\.\d+(\.\d+)?/g) ?? [];

export function matches(e: NotebookEntry, q: string): boolean {
  if (!q.trim()) return true;
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hay = fold(`${e.title} ${e.snippet}`);
  return fold(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export async function loadNotebook(db: SupabaseClient, f: { q?: string; book?: string; kind?: string } = {}): Promise<NotebookEntry[]> {
  const [items, lessons, sermons, marks, deep, vnotes] = await Promise.all([
    db.from("notebook_items").select("id, kind, title, content, book_codes, session_id, created_at").order("created_at", { ascending: false }).limit(300),
    db.from("lesson_plans").select("id, session_id, data, updated_at").order("updated_at", { ascending: false }).limit(100),
    db.from("sermon_outlines").select("id, session_id, data, updated_at").order("updated_at", { ascending: false }).limit(100),
    db.from("bookmarks").select("ref, version_id, note, created_at").order("created_at", { ascending: false }).limit(300),
    db.from("sessions").select("id, topic, started_at, context").eq("mode", "deep").order("started_at", { ascending: false }).limit(100),
    db.from("verse_notes").select("id, ref_start, ref_end, text, context, created_at").order("created_at", { ascending: false }).limit(300),
  ]);
  const out: NotebookEntry[] = [];
  for (const i of items.data ?? []) {
    const c = (i.content ?? {}) as { summary?: string; text?: string };
    out.push({ id: `n:${i.id}`, kind: i.kind as NotebookKind, title: i.title, snippet: clip(c.summary ?? c.text ?? ""), date: i.created_at, books: i.book_codes ?? [], sessionId: i.session_id ?? undefined });
  }
  for (const l of lessons.data ?? []) {
    const d = (l.data ?? {}) as { title?: string; base_text?: string; objective?: string[] };
    if (!d.title && !d.objective?.length) continue;
    out.push({ id: `l:${l.id}`, kind: "lesson", title: d.title ?? "Plano de aula", snippet: clip(d.objective?.join(" ") ?? d.base_text ?? ""), date: l.updated_at, books: booksOf(refsIn(JSON.stringify(d))), sessionId: l.session_id ?? undefined });
  }
  for (const s of sermons.data ?? []) {
    const d = (s.data ?? {}) as { title?: string; central_idea?: string };
    if (!d.title && !d.central_idea) continue;
    out.push({ id: `s:${s.id}`, kind: "sermon", title: d.title ?? "Esboço de sermão", snippet: clip(d.central_idea ?? ""), date: s.updated_at, books: booksOf(refsIn(JSON.stringify(d))), sessionId: s.session_id ?? undefined });
  }
  for (const d of deep.data ?? []) out.push({ id: `d:${d.id}`, kind: "deep", title: `Aprofundar: ${d.topic ?? ""}`.trim(), snippet: "", date: d.started_at, books: booksOf(refsIn(String((d.context as { ref?: string })?.ref ?? ""))), sessionId: d.id });
  for (const m of marks.data ?? []) out.push({ id: `b:${m.ref}:${m.version_id}`, kind: "bookmark", title: m.ref, snippet: clip(m.note ?? ""), date: m.created_at, books: booksOf([m.ref]), ref: m.ref });
  // notes the student wrote on verses in the reader (spec 8.24): the title is the passage, the snippet the note
  for (const n of vnotes.data ?? []) out.push({ id: `vn:${n.id}`, kind: "verse_note", title: n.ref_start === n.ref_end ? n.ref_start : `${n.ref_start}-${n.ref_end}`, snippet: clip(`${n.context ? `${n.context}: ` : ""}${n.text}`), date: n.created_at, books: booksOf([n.ref_start]), ref: n.ref_start });
  return out
    .filter((e) => (!f.kind || e.kind === f.kind) && (!f.book || e.books.includes(f.book)) && matches(e, f.q ?? ""))
    .sort((a, b) => b.date.localeCompare(a.date));
}
