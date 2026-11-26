"use client";

// Notes on verses (spec 8.24, RF-M24-06): by book, date, context and tag; search; order by date or by the Bible.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { COLOR_CLASS, NoteForm } from "@/components/reader/NoteForm";
import { Card } from "@/components/ui/Card";
import { deleteVerseNote, getVerseNotes, type NoteFilters, type VerseNote } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { BOOK_BY_CODE } from "@/lib/knowledge/books";
import { labelOf } from "@/lib/reading/format";

const sel = "min-h-11 rounded-control border border-line bg-surface px-2 text-base text-ink";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

export default function VerseNotesPage() {
  const [notes, setNotes] = useState<VerseNote[] | null>(null);
  const [facets, setFacets] = useState<{ contexts: string[]; tags: string[]; books: Record<string, number> }>({ contexts: [], tags: [], books: {} });
  const [f, setF] = useState<{ book: string; context: string; tag: string; when: "any" | "today" | "week" | "month"; q: string; order: "date" | "bible" }>({ book: "", context: "", tag: "", when: "any", q: "", order: "date" });
  const [editing, setEditing] = useState<VerseNote | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const filters: NoteFilters = { book: f.book, context: f.context, tag: f.tag, q: f.q, order: f.order, from: f.when === "today" ? iso(new Date()) : f.when === "week" ? daysAgo(7) : f.when === "month" ? daysAgo(30) : undefined };
    try { const r = await getVerseNotes(filters); setNotes(r.notes); setFacets({ contexts: r.contexts, tags: r.tags, books: r.books }); setError(false); } catch { setError(true); setNotes((n) => n ?? []); }
  }, [f]);
  useEffect(() => { const h = setTimeout(() => void load(), 250); return () => clearTimeout(h); }, [load]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
      <Link href="/biblia" className="text-sm underline">← {t("notes.back")}</Link>
      <h1 className="text-3xl">{t("notes.title")}</h1>
      <input className={sel} type="search" placeholder={t("notes.search")} aria-label={t("notes.search")} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs text-muted">{t("notes.book")}
          <select className={sel} value={f.book} onChange={(e) => setF({ ...f, book: e.target.value })}><option value="">{t("notes.all")}</option>{Object.keys(facets.books).sort().map((b) => <option key={b} value={b}>{BOOK_BY_CODE[b]?.pt ?? b} ({facets.books[b]})</option>)}</select></label>
        <label className="flex flex-col text-xs text-muted">{t("notes.context")}
          <select className={sel} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })}><option value="">{t("notes.all")}</option>{facets.contexts.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        {facets.tags.length > 0 && <label className="flex flex-col text-xs text-muted">{t("notes.tag")}
          <select className={sel} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}><option value="">{t("notes.all")}</option>{facets.tags.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>}
        <label className="flex flex-col text-xs text-muted">{t("notes.date")}
          <select className={sel} value={f.when} onChange={(e) => setF({ ...f, when: e.target.value as typeof f.when })}>{(["any", "today", "week", "month"] as const).map((k) => <option key={k} value={k}>{t(`notes.date.${k}` as "notes.date.any")}</option>)}</select></label>
        <label className="flex flex-col text-xs text-muted">{t("notes.order")}
          <select className={sel} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value as "date" | "bible" })}><option value="date">{t("notes.order.date")}</option><option value="bible">{t("notes.order.bible")}</option></select></label>
      </div>
      {error && <p role="alert" className="text-sm text-danger-ink">{t("reader.error")}</p>}
      {notes === null ? <p className="text-muted">{t("common.loading")}</p> : notes.length === 0 ? <p className="text-muted">{t("notes.empty")}</p> : (
        <>
          <p className="text-xs text-muted">{t("notes.count").replace("{n}", String(notes.length))}</p>
          <ul className="flex flex-col gap-2">
            {notes.map((n) => {
              const refs = n.ref_start === n.ref_end ? [n.ref_start] : (() => { const [b, c, a] = n.ref_start.split("."); const z = Number(n.ref_end.split(".")[2]); return Array.from({ length: Math.max(1, z - Number(a) + 1) }, (_, i) => `${b}.${c}.${Number(a) + i}`); })();
              return (
                <li key={n.id}>
                  <Card className={`flex flex-col gap-1 ${n.color ? `border-l-8 ${COLOR_CLASS[n.color].replace("bg-", "border-")}` : ""}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{labelOf(refs)}</strong><span className="text-xs text-muted">{new Date(n.created_at).toLocaleDateString()}{n.context ? ` · ${n.context}` : ""}</span></div>
                    <p className="whitespace-pre-line">{n.text}</p>
                    {n.tags.length > 0 && <p className="text-xs text-muted">{n.tags.map((x) => `#${x}`).join(" ")}</p>}
                    <div className="flex gap-3 text-sm">
                      <Link className="underline" href={`/biblia?v=${n.version_id}&r=${n.ref_start}`}>{t("notes.open")}</Link>
                      <button type="button" className="underline" onClick={() => setEditing(n)}>{t("note.edit")}</button>
                      <button type="button" className="underline" onClick={() => void deleteVerseNote(n.id).then(load)}>{t("note.delete")}</button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing && <NoteForm versionId={editing.version_id} refs={[editing.ref_start, editing.ref_end]} note={editing} knownContexts={facets.contexts} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </main>
  );
}
