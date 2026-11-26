"use client";

// Note on the selected verses (spec 8.24, RF-M24-06): text, context (a label that groups notes: Devocional, Sermão...), tags and colour.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { addVerseNote, updateVerseNote, type NoteColor, type VerseNote } from "@/lib/api-client";
import { t, type MessageKey } from "@/lib/i18n";
import { labelOf } from "@/lib/reading/format";

const COLORS: NoteColor[] = ["yellow", "green", "blue", "pink", "orange"];
export const COLOR_CLASS: Record<NoteColor, string> = { yellow: "bg-yellow-200", green: "bg-green-200", blue: "bg-blue-200", pink: "bg-pink-200", orange: "bg-orange-200" };
const field = "rounded-control border border-line bg-surface px-3 text-base text-ink";

export function NoteForm({ versionId, refs, note, knownContexts, onSaved, onClose }: { versionId: string; refs: string[]; note?: VerseNote; knownContexts: string[]; onSaved(n: VerseNote): void; onClose(): void }) {
  const suggestions = [...new Set([...([1, 2, 3, 4, 5, 6] as const).map((i) => t(`note.ctx.${i}` as MessageKey)), ...knownContexts])];
  const [text, setText] = useState(note?.text ?? "");
  const [context, setContext] = useState(note?.context ?? "");
  const [tags, setTags] = useState((note?.tags ?? []).join(", "));
  const [color, setColor] = useState<NoteColor | null>(note?.color ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function save() {
    setBusy(true); setErr(false);
    const tagList = tags.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8);
    try {
      const r = note
        ? await updateVerseNote(note.id, { text: text.trim(), context: context.trim() || null, tags: tagList, color })
        : await addVerseNote({ version_id: versionId, ref_start: refs[0], ref_end: refs[refs.length - 1], text: text.trim(), context: context.trim() || null, tags: tagList, color });
      onSaved(r.note);
    } catch { setErr(true); setBusy(false); }
  }

  return (
    <Modal title={`${t("note.title")}: ${labelOf(refs)}`} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void save(); }}>
        <textarea className={`${field} min-h-32 p-3`} placeholder={t("note.placeholder")} aria-label={t("note.title")} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} autoFocus />
        <label className="flex flex-col gap-1 text-sm">{t("note.context")}
          <input className={`${field} h-11`} list="note-contexts" value={context} onChange={(e) => setContext(e.target.value)} maxLength={40} placeholder={t("note.context.new")} />
          <datalist id="note-contexts">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">{t("note.tags")}
          <input className={`${field} h-11`} value={tags} onChange={(e) => setTags(e.target.value)} maxLength={120} />
        </label>
        <fieldset className="flex flex-wrap items-center gap-2 text-sm">
          <legend className="mb-1">{t("note.color")}</legend>
          <button type="button" aria-pressed={color === null} className={`min-h-9 rounded-control border px-3 ${color === null ? "border-primary" : "border-line"}`} onClick={() => setColor(null)}>{t("note.color.none")}</button>
          {COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={color === c} className={`h-9 w-9 rounded-full border-2 ${COLOR_CLASS[c]} ${color === c ? "border-primary" : "border-transparent"}`} onClick={() => setColor(c)} />)}
        </fieldset>
        {err && <Toast>{t("reader.error")}</Toast>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !text.trim()}>{t("note.save")}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>{t("note.cancel")}</Button>
        </div>
      </form>
    </Modal>
  );
}
