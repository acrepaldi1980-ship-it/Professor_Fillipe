"use client";

// Notebook (RF-M09-04): everything the student produced, by theme (search), Bible book and kind; personal notes; PDF export.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { addNote, deleteNote, exportNotebook, getNotebook, type NotebookEntry } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

const KINDS = ["session", "lesson", "sermon", "deep", "bookmark", "note", "verse_note"] as const;
const input = "h-11 rounded-control border border-line bg-surface px-3 text-base text-ink";

export default function NotebookPage() {
  const [items, setItems] = useState<NotebookEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [book, setBook] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await getNotebook(q, book, kind)).items); setOffline(false); } catch { setItems((v) => v ?? []); setOffline(!navigator.onLine); }
  }, [q, book, kind]);
  useEffect(() => { const h = setTimeout(() => void load(), 250); return () => clearTimeout(h); }, [load]);

  const books = [...new Set((items ?? []).flatMap((e) => e.books))].sort();
  const open = (e: NotebookEntry) => (e.kind === "session" && e.sessionId ? `/fechamento?s=${e.sessionId}` : e.sessionId ? `/estudo?s=${e.sessionId}` : null);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("notebook.title")}</h1>
      {offline && <p role="status" className="rounded-control bg-surface p-2 text-sm text-muted">{t("offline.banner")}</p>}
      <input className={input} type="search" placeholder={t("notebook.search")} aria-label={t("notebook.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {["", ...KINDS].map((k) => <button key={k || "all"} type="button" aria-pressed={kind === k} className={`min-h-9 rounded-control border px-3 text-sm ${kind === k ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => setKind(k)}>{k ? t(`nb.kind.${k}` as "nb.kind.note") : t("notebook.all")}</button>)}
        {books.length > 0 && (
          <select className="min-h-9 rounded-control border border-line bg-surface px-2 text-sm" aria-label={t("notebook.book")} value={book} onChange={(e) => setBook(e.target.value)}>
            <option value="">{t("notebook.book")}: {t("notebook.all")}</option>
            {books.map((b) => <option key={b} value={b}>{formatRefPt(`${b}.1`).replace(/ \d+$/, "")}</option>)}
          </select>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setAdding(!adding)}>{t("notebook.new")}</Button>
        <Button type="button" variant="ghost" onClick={() => void exportNotebook("all")}>{t("notebook.export.all")}</Button>
      </div>
      {adding && (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void addNote(title.trim(), text.trim()).then(() => { setTitle(""); setText(""); setAdding(false); void load(); }); }}>
          <input className={input} placeholder={t("notebook.note.title")} aria-label={t("notebook.note.title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <textarea className="min-h-24 rounded-control border border-line bg-surface p-2" placeholder={t("notebook.note.text")} aria-label={t("notebook.note.text")} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" disabled={!title.trim()}>{t("notebook.save")}</Button>
        </form>
      )}
      {items === null ? <p className="text-muted">{t("common.loading")}</p> : items.length === 0 ? <p className="text-muted">{t("notebook.empty")}</p> : (
        <ul className="flex flex-col gap-2">
          {items.map((e) => {
            const href = open(e);
            return (
              <li key={e.id}>
                <Card className="flex flex-col gap-1">
                  <div className="text-xs text-muted">{t(`nb.kind.${e.kind}` as "nb.kind.note")} · {new Date(e.date).toLocaleDateString("pt-BR")}</div>
                  <strong>{e.kind === "bookmark" || e.kind === "verse_note" ? formatRefPt(e.title) : e.title}</strong>
                  {e.snippet && <p className="text-sm text-muted">{e.snippet}</p>}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {href && <Link className="underline" href={href}>{t("notebook.open")}</Link>}
                    {e.id.startsWith("n:") && <button type="button" className="underline" onClick={() => void exportNotebook(e.id)}>{t("notebook.export.one")}</button>}
                    {e.kind === "note" && <button type="button" className="underline" onClick={() => void deleteNote(e.id).then(load)}>{t("notebook.delete")}</button>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
