"use client";

// Live document beside the conversation (lesson plan or sermon outline): filled by the teacher through mode_payload,
// editable by hand, with the list of gaps and the PDF download (spec 8.7.2/8.7.3).
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { downloadSessionPdf, getSessionDocument, saveSessionDocument, suggestDocumentSection, type SuggestResult } from "@/lib/api-client";
import { ResearchBar } from "./ResearchBar";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";

type Doc = Record<string, unknown>;
type Item = { title?: string; verses?: string[]; texts?: string[]; explanation?: string; illustration?: string; application?: string };
type Field = { key: string; kind: "text" | "lines" | "items"; mode: "lesson" | "sermon" };

const FIELDS: Field[] = [
  { key: "title", kind: "text", mode: "lesson" }, { key: "base_text", kind: "text", mode: "lesson" }, { key: "objective", kind: "lines", mode: "lesson" },
  { key: "icebreaker", kind: "text", mode: "lesson" }, { key: "context", kind: "text", mode: "lesson" }, { key: "points", kind: "items", mode: "lesson" },
  { key: "dynamic", kind: "text", mode: "lesson" }, { key: "questions", kind: "lines", mode: "lesson" }, { key: "application", kind: "text", mode: "lesson" },
  { key: "memory_verse", kind: "text", mode: "lesson" }, { key: "visuals", kind: "lines", mode: "lesson" }, { key: "sources", kind: "lines", mode: "lesson" },
  { key: "title", kind: "text", mode: "sermon" }, { key: "base_text", kind: "text", mode: "sermon" }, { key: "central_idea", kind: "text", mode: "sermon" },
  { key: "introduction", kind: "text", mode: "sermon" }, { key: "divisions", kind: "items", mode: "sermon" }, { key: "conclusion", kind: "text", mode: "sermon" },
  { key: "appeal", kind: "text", mode: "sermon" }, { key: "sources", kind: "lines", mode: "sermon" },
];

const label = (k: string) => t(`doc.field.${k}` as "doc.field.title");
const showRef = (r: string) => (/^[0-9A-Z]{3}\.\d+/.test(r) ? formatRefPt(r) : r);

export function DocPanel({ sessionId, mode, refreshKey }: { sessionId: string; mode: "lesson" | "sermon"; refreshKey: number }) {
  const [doc, setDoc] = useState<Doc>({});
  const [gaps, setGaps] = useState<string[]>([]);
  const [gapKeys, setGapKeys] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    // an older, slower answer must never replace a newer one
    void getSessionDocument(sessionId).then((r) => { if (mine === seq.current) { setDoc((r.doc ?? {}) as Doc); setGaps(r.gaps); setGapKeys(r.gapKeys ?? []); } }).catch(() => undefined);
  }, [sessionId, refreshKey]);

  const fields = FIELDS.filter((f) => f.mode === mode);

  const onResearch = useCallback((r: SuggestResult) => { ++seq.current; setDoc((r.doc ?? {}) as Doc); setGaps(r.gaps); setGapKeys(r.gapKeys); }, []);

  // the teacher proposes one section and it goes into the document; the person edits it afterwards
  async function suggest(key: string) {
    setSuggesting(key);
    setSuggestError(false);
    try {
      const r = await suggestDocumentSection(sessionId, key);
      ++seq.current;
      setDoc((r.doc ?? {}) as Doc);
      setGaps(r.gaps);
      setGapKeys(r.gapKeys);
    } catch {
      setSuggestError(true);
    }
    setSuggesting(null);
  }

  async function save(key: string, value: unknown) {
    setError(false);
    try {
      await saveSessionDocument(sessionId, { [key]: value });
      const mine = ++seq.current;
      const r = await getSessionDocument(sessionId);
      if (mine === seq.current) { setDoc((r.doc ?? {}) as Doc); setGaps(r.gaps); setGapKeys(r.gapKeys ?? []); }
      setEditing(null);
    } catch {
      setError(true);
    }
  }

  function startEdit(f: Field) {
    const v = doc[f.key];
    setEditing(f.key);
    setDraft(f.kind === "lines" ? ((v as string[] | undefined) ?? []).join("\n") : f.kind === "items" ? ((v as Item[] | undefined) ?? []).map((x) => ({ ...x })) : (v as string | undefined) ?? "");
  }

  function commit(f: Field) {
    if (f.kind === "text") return void save(f.key, String(draft).trim() || undefined);
    if (f.kind === "lines") return void save(f.key, String(draft).split("\n").map((x) => x.trim()).filter(Boolean));
    const items = (draft as Item[]).filter((x) => x.title?.trim());
    const key = mode === "lesson" ? "verses" : "texts";
    void save(f.key, items.map((x) => ({ ...x, [key]: ((x as Record<string, unknown>)[`${key}_raw`] as string | undefined)?.split(",").map((s) => s.trim()).filter(Boolean) ?? (x as Record<string, unknown>)[key] ?? [], [`${key}_raw`]: undefined })));
  }

  const empty = fields.every((f) => !doc[f.key] || (Array.isArray(doc[f.key]) && !(doc[f.key] as unknown[]).length));
  return (
    <aside aria-label={t(mode === "lesson" ? "doc.lesson" : "doc.sermon")} className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg">{t(mode === "lesson" ? "doc.lesson" : "doc.sermon")}</h2>
        <Button type="button" variant="ghost" className="text-sm" onClick={() => void downloadSessionPdf(sessionId).catch(() => setError(true))}>{t("doc.pdf")}</Button>
      </div>
      <ResearchBar sessionId={sessionId} mode={mode} onUpdate={onResearch} />
      {empty && <p className="text-sm text-muted">{t("doc.empty")}</p>}
      {fields.map((f) => {
        const v = doc[f.key];
        const has = Array.isArray(v) ? v.length > 0 : !!v;
        if (editing === f.key) {
          return (
            <section key={f.key} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{label(f.key)}</h3>
              {f.kind === "items" ? (
                <>
                  {(draft as Item[]).map((it, i) => (
                    <div key={i} className="flex flex-col gap-1 rounded-control border border-line p-2">
                      <input aria-label={t("doc.item.title")} placeholder={t("doc.item.title")} className="h-10 rounded-control border border-line bg-bg px-2" value={it.title ?? ""} onChange={(e) => setDraft((draft as Item[]).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                      <input aria-label={t("doc.item.texts")} placeholder={t("doc.item.texts")} className="h-10 rounded-control border border-line bg-bg px-2" defaultValue={((mode === "lesson" ? it.verses : it.texts) ?? []).join(", ")} onChange={(e) => setDraft((draft as Item[]).map((x, j) => (j === i ? { ...x, [`${mode === "lesson" ? "verses" : "texts"}_raw`]: e.target.value } : x)))} />
                      <textarea aria-label={t("doc.item.explanation")} placeholder={t("doc.item.explanation")} className="min-h-16 rounded-control border border-line bg-bg p-2" value={it.explanation ?? ""} onChange={(e) => setDraft((draft as Item[]).map((x, j) => (j === i ? { ...x, explanation: e.target.value } : x)))} />
                      <input aria-label={t("doc.item.illustration")} placeholder={t("doc.item.illustration")} className="h-10 rounded-control border border-line bg-bg px-2" value={it.illustration ?? ""} onChange={(e) => setDraft((draft as Item[]).map((x, j) => (j === i ? { ...x, illustration: e.target.value } : x)))} />
                      {mode === "sermon" && <input aria-label={t("doc.item.application")} placeholder={t("doc.item.application")} className="h-10 rounded-control border border-line bg-bg px-2" value={it.application ?? ""} onChange={(e) => setDraft((draft as Item[]).map((x, j) => (j === i ? { ...x, application: e.target.value } : x)))} />}
                      <button type="button" className="self-start text-sm underline" onClick={() => setDraft((draft as Item[]).filter((_, j) => j !== i))}>{t("doc.item.remove")}</button>
                    </div>
                  ))}
                  <button type="button" className="self-start text-sm underline" onClick={() => setDraft([...(draft as Item[]), { title: "" }])}>{t("doc.item.add")}</button>
                </>
              ) : (
                <textarea aria-label={label(f.key)} className="min-h-24 rounded-control border border-line bg-bg p-2" value={String(draft)} onChange={(e) => setDraft(e.target.value)} />
              )}
              {f.kind === "lines" && <p className="text-xs text-muted">{t("doc.lines.hint")}</p>}
              <div className="flex gap-2"><Button type="button" className="text-sm" onClick={() => commit(f)} disabled={busy}>{t("doc.save")}</Button><Button type="button" variant="ghost" className="text-sm" onClick={() => { setEditing(null); setBusy(false); }}>{t("doc.cancel")}</Button></div>
            </section>
          );
        }
        return (
          <section key={f.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{label(f.key)}</h3><button type="button" className="text-xs underline" onClick={() => startEdit(f)}>{t("doc.edit")}</button></div>
            {has ? (
              f.kind === "text" ? <p className="whitespace-pre-line text-sm">{String(v)}</p>
              : f.kind === "lines" ? <ul className="list-disc pl-5 text-sm">{(v as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>
              : <ol className="list-decimal pl-5 text-sm">{(v as Item[]).map((x, i) => <li key={i}><strong>{x.title}</strong>{(x.verses ?? x.texts)?.length ? <span className="text-muted"> ({(x.verses ?? x.texts)!.map(showRef).join("; ")})</span> : null}{x.explanation ? <div>{x.explanation}</div> : null}{x.application ? <div className="italic">{x.application}</div> : null}</li>)}</ol>
            ) : <p className="text-xs text-muted">—</p>}
          </section>
        );
      })}
      <section className="border-t border-line pt-2">
        <h3 className="text-sm font-semibold">{t("doc.gaps")}</h3>
        {suggestError && <p role="alert" className="text-sm text-muted">{t("doc.gap.error")}</p>}
        {gaps.length ? <ul className="list-disc pl-5 text-sm text-muted">{gaps.map((g, i) => <li key={g}>{g}{gapKeys[i] && <> <button type="button" className="text-primary underline disabled:opacity-50" disabled={suggesting !== null} onClick={() => void suggest(gapKeys[i])}>{suggesting === gapKeys[i] ? t("doc.gap.working") : t("doc.gap.suggest")}</button></>}</li>)}</ul> : <p className="text-sm text-muted">{t("doc.complete")}</p>}
      </section>
      {error && <p role="alert" className="text-sm text-danger-ink">{t("consent.error")}</p>}
    </aside>
  );
}
