"use client";

// "Entender" (spec 8.24, RF-M24-05): what the library knows about the selected verses (people and places with their entry, original words, related passages,
// all without a model) and, on request, the teacher's short explanation.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ApiError, explainVerses, getVerseHelp, type VerseHelp } from "@/lib/api-client";
import { getLanguage, t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { labelOf } from "@/lib/reading/format";

export function HelpPanel({ versionId, refs, onClose }: { versionId: string; refs: string[]; onClose(): void }) {
  const [help, setHelp] = useState<VerseHelp | null>(null);
  const [failed, setFailed] = useState(false);
  const [teacher, setTeacher] = useState<{ text: string; citations: { work_id: string; label: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<"limit" | "unavailable" | null>(null);
  const first = refs[0], last = refs[refs.length - 1];

  useEffect(() => {
    let alive = true;
    setHelp(null); setFailed(false); setTeacher(null); setMsg(null);
    getVerseHelp(versionId, first, last).then((h) => alive && setHelp(h)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [versionId, first, last]);

  async function ask(refresh = false) {
    setBusy(true); setMsg(null);
    try {
      const r = await explainVerses({ version_id: versionId, ref_start: first, ref_end: last, locale: getLanguage(), refresh });
      setTeacher({ text: r.text, citations: r.citations });
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 429 ? "limit" : "unavailable");
    } finally { setBusy(false); }
  }

  const empty = help && !help.entities.length && !help.words.length && !help.related.length;
  return (
    <Modal title={`${t("help.title")}: ${labelOf(refs)}`} onClose={onClose}>
      <div className="flex flex-col gap-4" data-testid="verse-help">
        {!help && !failed && <p role="status" className="text-muted">{t("help.loading")}</p>}
        {failed && <Toast>{t("reader.error")}</Toast>}
        {help && help.verses.length > 0 && (
          <blockquote className="border-l-4 border-primary pl-3 text-base">
            {help.verses.map((v) => <p key={v.ref}><sup className="mr-1 text-muted">{v.ref.split(".")[2]}</sup>{v.text}</p>)}
          </blockquote>
        )}

        <section aria-labelledby="h-teacher" className="flex flex-col gap-2">
          <h3 id="h-teacher" className="text-lg">{t("help.teacher")}</h3>
          {teacher ? (
            <>
              <p className="whitespace-pre-line" data-testid="teacher-explanation">{teacher.text}</p>
              {teacher.citations.length > 0 && <p className="text-xs text-muted">{t("help.sources")}: {teacher.citations.map((c) => c.label).join("; ")}</p>}
              <button type="button" className="self-start text-sm underline" onClick={() => void ask(true)} disabled={busy}>{t("help.teacher.again")}</button>
            </>
          ) : (
            <Button type="button" variant="accent" onClick={() => void ask()} disabled={busy} aria-busy={busy}>{busy ? t("help.teacher.loading") : t("help.teacher.ask")}</Button>
          )}
          {msg === "limit" && <Toast tone="warn">{t("help.limit")}</Toast>}
          {msg === "unavailable" && <Toast tone="warn">{t("help.teacher.unavailable")}</Toast>}
        </section>

        {help && help.entities.length > 0 && (
          <section aria-labelledby="h-who" className="flex flex-col gap-2">
            <h3 id="h-who" className="text-lg">{t("help.who")}</h3>
            <ul className="flex flex-col gap-2">
              {help.entities.map((e) => (
                <li key={e.id} className="rounded-control border border-line p-2">
                  <strong>{e.name}</strong> <span className="text-xs text-muted">({t(e.kind === "person" ? "help.person" : "help.place")}{e.name !== e.en ? `, ${e.en}` : ""})</span>
                  {e.entry && <p className="mt-1 text-sm">{e.entry.snippet} <span className="text-xs text-muted">[{e.entry.source}]</span></p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {help && help.words.length > 0 && (
          <section aria-labelledby="h-words" className="flex flex-col gap-2">
            <h3 id="h-words" className="text-lg">{t("help.words")}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {help.words.map((w) => (
                <li key={`${w.strong}-${w.surface}`}><strong lang="el">{w.surface}</strong> {w.translit && <i>({w.translit})</i>} · {w.strong}: {w.gloss}{w.meaning ? ` — ${w.meaning}` : ""}</li>
              ))}
            </ul>
          </section>
        )}

        {help && help.related.length > 0 && (
          <section aria-labelledby="h-rel" className="flex flex-col gap-2">
            <h3 id="h-rel" className="text-lg">{t("help.related")}</h3>
            <p className="flex flex-wrap gap-2">
              {help.related.map((r) => <Link key={r} href={`/biblia?v=${versionId}&r=${r}`} className="rounded-control border border-line px-2 py-1 text-sm underline" onClick={onClose}>{formatRefPt(r)}</Link>)}
            </p>
          </section>
        )}
        {empty && <p className="text-sm text-muted">{t("help.none")}</p>}
        {help && help.sources.length > 0 && <p className="text-xs text-muted">{t("help.sources")}: {help.sources.map((s) => s.label).join("; ")}</p>}

        <div className="flex flex-wrap gap-2">
          <Link href={`/estudo?tema=${encodeURIComponent(`${labelOf(refs)}`)}`} className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-primary-ink">{t("help.chat")}</Link>
          <Button type="button" variant="ghost" onClick={onClose}>{t("help.close")}</Button>
        </div>
      </div>
    </Modal>
  );
}
