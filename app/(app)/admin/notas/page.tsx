"use client";

// Review panel of the own Pentecostal notes (Prompt 1.4): list, read, edit drafts, comment and move through the workflow.
import { useCallback, useEffect, useState } from "react";
import { commentNote, getNote, listNotes, patchNote, type NoteComment, type NoteDetail, type NoteListItem, type NoteStatus } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { nextMoves, type Role } from "@/lib/notes/status";

const STATUSES: NoteStatus[] = ["draft", "in_review", "approved", "published"];

export default function NotesAdminPage() {
  const [role, setRole] = useState<Role>("reviewer");
  const [filter, setFilter] = useState<NoteStatus | "all">("draft");
  const [items, setItems] = useState<NoteListItem[] | null>(null);
  const [open, setOpen] = useState<{ note: NoteDetail; comments: NoteComment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listNotes(filter === "all" ? undefined : filter);
      setRole(r.role);
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message === "api_error_403" ? t("admin.notes.forbidden") : t("admin.error"));
    }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const show = async (id: string) => {
    const r = await getNote(id);
    setOpen({ note: r.note, comments: r.comments });
    setEditing(null);
  };
  const move = async (to: NoteStatus) => {
    if (!open) return;
    await patchNote(open.note.id, { status: to });
    await show(open.note.id);
    await load();
  };

  if (error) return <main className="p-6"><p role="alert">{error}</p></main>;

  if (open) {
    const n = open.note;
    const rep = n.originality_report;
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
        <button className="self-start text-sm underline" onClick={() => setOpen(null)}>{t("admin.notes.back")}</button>
        <h1 className="text-2xl">{n.title}</h1>
        <p className="text-sm text-muted">{t(`admin.notes.kind.${n.kind as "intro" | "pericope" | "article"}`)} · {t(`admin.notes.status.${n.status}`)}</p>
        {editing !== null ? (
          <div className="flex flex-col gap-2">
            <textarea className="min-h-72 rounded-control border border-line bg-surface p-2" value={editing} onChange={(e) => setEditing(e.target.value)} />
            <button className="self-start rounded-control bg-primary px-3 py-1 text-white" onClick={async () => { await patchNote(n.id, { body: editing }); await show(n.id); }}>{t("admin.notes.save")}</button>
          </div>
        ) : (
          <article className="whitespace-pre-line rounded-control border border-line bg-surface p-3">{n.body}</article>
        )}
        {rep && (
          <section className="text-sm">
            <h2 className="text-lg">{t("admin.notes.originality")}</h2>
            <p>{t("admin.notes.originality.help").replace("{max}", rep.maxSimilarity.toFixed(2)).replace("{limit}", String(rep.threshold)).replace("{rewrites}", String(rep.rewrites))}</p>
          </section>
        )}
        {n.sources.length > 0 && (
          <section className="text-sm">
            <h2 className="text-lg">{t("admin.notes.sources")}</h2>
            <ul className="list-disc pl-5">{n.sources.map((s, i) => <li key={i}>{s.label}</li>)}</ul>
          </section>
        )}
        <div className="flex flex-wrap gap-2">
          {n.status === "draft" && editing === null && <button className="rounded-control border border-line px-3 py-1" onClick={() => setEditing(n.body)}>{t("admin.notes.edit")}</button>}
          {nextMoves(n.status, role).map((to) => (
            <button key={to} className="rounded-control bg-primary px-3 py-1 text-white" onClick={() => void move(to)}>{t(`admin.notes.move.${to}`)}</button>
          ))}
        </div>
        <section>
          <h2 className="text-lg">{t("admin.notes.comments")}</h2>
          <ul className="mb-2 flex flex-col gap-1 text-sm">{open.comments.map((c) => <li key={c.id} className="rounded-control border border-line bg-surface p-2">{c.body}</li>)}</ul>
          <textarea className="w-full rounded-control border border-line bg-surface p-2" placeholder={t("admin.notes.comment.placeholder")} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="mt-1 rounded-control border border-line px-3 py-1" disabled={!comment.trim()} onClick={async () => { await commentNote(n.id, comment.trim()); setComment(""); await show(n.id); }}>{t("admin.notes.comment.send")}</button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 p-4 pb-24">
      <h1 className="text-3xl">{t("admin.notes.title")}</h1>
      <p className="text-sm text-muted">{t("admin.notes.help")}</p>
      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} className={`rounded-control border px-3 py-1 text-sm ${filter === s ? "border-primary bg-primary text-white" : "border-line"}`} onClick={() => setFilter(s)}>
            {s === "all" ? t("admin.notes.filter.all") : t(`admin.notes.status.${s}`)}
          </button>
        ))}
      </div>
      {!items ? <p className="text-muted">{t("common.loading")}</p> : items.length === 0 ? <p>{t("admin.notes.empty")}</p> : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button className="w-full rounded-control border border-line bg-surface p-3 text-left" onClick={() => void show(n.id)}>
                <strong>{n.title}</strong>
                <div className="text-sm text-muted">{t(`admin.notes.kind.${n.kind as "intro" | "pericope" | "article"}`)} · {t(`admin.notes.status.${n.status}`)}{n.originality_score != null ? ` · ${t("admin.notes.originality")} ${n.originality_score.toFixed(2)}` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
