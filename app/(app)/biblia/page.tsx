"use client";

// Bible reader (spec 8.24, M24): choose the version, read by book and chapter, mark what was read, take notes, share, and understand the passage.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpPanel } from "@/components/reader/HelpPanel";
import { COLOR_CLASS, NoteForm } from "@/components/reader/NoteForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { addBookmark, getBibleVerses, getBookReads, getLenses, getReadingPlan, getReadProgress, getReaderState, getVerseNotes, markRead, saveReaderState, setPlanDay, unmarkRead, type BibleVersionInfo, type PlanDetail, type ReaderState, type VerseNote } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { BOOKS, BOOK_BY_CODE } from "@/lib/knowledge/books";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { getPlatform } from "@/lib/platform";
import { chapterIsRead, labelOf, shareText } from "@/lib/reading/format";
import { chapterVerseRefs, totalVerses } from "@/lib/reading/plans";

const LANG_NAMES: Record<string, string> = { por: "Português", pt: "Português", eng: "English", en: "English", spa: "Español", es: "Español", grc: "Grego", heb: "Hebraico", lat: "Latim", la: "Latim" };
const langName = (l: string) => LANG_NAMES[l] ?? l;
const NT_START = BOOKS.findIndex((b) => b.code === "MAT");
const select = "min-h-11 rounded-control border border-line bg-surface px-2 text-base text-ink";

function ReaderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<ReaderState | null>(null);
  const [versions, setVersions] = useState<BibleVersionInfo[]>([]);
  const [version, setVersion] = useState<string>("");
  const [compare, setCompare] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string>("");       // "JHN.3"
  const [focus, setFocus] = useState<string | null>(null);   // verse to scroll to
  const [verses, setVerses] = useState<{ ref: string; text: string }[] | null>(null);
  const [other, setOther] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ books: Record<string, number>; total: number } | null>(null);
  const [notes, setNotes] = useState<VerseNote[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [font, setFont] = useState(1);
  const [picker, setPicker] = useState(false);
  const [pickBook, setPickBook] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [noting, setNoting] = useState<{ note?: VerseNote; refs: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ plan: PlanDetail; day: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); }, []);

  const book = chapter.split(".")[0];
  const chapterNo = Number(chapter.split(".")[1]);
  const info = BOOK_BY_CODE[book];

  // start: reader state, the versions available and the progress
  useEffect(() => {
    (async () => {
      try {
        const [st, pref] = await Promise.all([getReaderState(), getLenses()]);
        setVersions(pref.versions); setState(st);
        const v = params.get("v") ?? st.version_id;
        setVersion(v); setCompare(st.compare_version_id); setFont(st.font_scale);
        const r = params.get("r") ?? st.last_ref ?? "JHN.1";
        const [b, c, vs] = r.split(".");
        setChapter(`${b}.${c ?? 1}`); setFocus(vs ? r : null);
        getReadProgress().then(setProgress).catch(() => undefined);
      } catch { setError(true); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the plan of the day, when the reader was opened from a plan
  useEffect(() => {
    const id = params.get("plan"), day = Number(params.get("day"));
    if (!id || !day) { setPlan(null); return; }
    getReadingPlan(id).then((r) => setPlan({ plan: r.plan, day })).catch(() => setPlan(null));
  }, [params]);

  // the chapter (and the comparison version)
  useEffect(() => {
    if (!version || !chapter) return;
    let alive = true;
    setVerses(null); setError(false); setSel([]);
    getBibleVerses(version, chapter).then((r) => alive && setVerses(r.verses)).catch(() => alive && setError(true));
    if (compare) getBibleVerses(compare, chapter).then((r) => alive && setOther(Object.fromEntries(r.verses.map((v) => [v.ref, v.text])))).catch(() => alive && setOther({})); else setOther({});
    return () => { alive = false; };
  }, [version, compare, chapter]);

  // what was read and the notes of this book and chapter
  useEffect(() => { if (book) getBookReads(book).then((r) => setRead(new Set(r.refs))).catch(() => setRead(new Set())); }, [book]);
  const loadNotes = useCallback(() => { if (book && chapterNo) getVerseNotes({ book, chapter: chapterNo }).then((r) => { setNotes(r.notes); setContexts(r.contexts); }).catch(() => setNotes([])); }, [book, chapterNo]);
  useEffect(loadNotes, [loadNotes]);

  // remember where the student stopped
  useEffect(() => {
    if (!version || !chapter || !state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveReaderState({ version_id: version, last_ref: chapter }).catch(() => undefined), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [version, chapter, state]);

  useEffect(() => { if (focus && verses) document.getElementById(`v-${focus}`)?.scrollIntoView({ block: "center" }); }, [focus, verses]);

  const chapterRefs = useMemo(() => (verses ? verses.map((v) => v.ref) : chapterVerseRefs(chapter)), [verses, chapter]);
  const chapterRead = chapterIsRead(read, chapterRefs);
  const bookPct = info ? Math.min(100, Math.round(((progress?.books[book] ?? 0) / Math.max(1, totalVerses(book))) * 100)) : 0;
  const biblePct = progress ? Math.min(100, Math.round((progress.total / 31102) * 100)) : 0;
  const versionName = versions.find((v) => v.id === version)?.name ?? version;

  function go(ref: string) { setChapter(ref); setFocus(null); setPicker(false); setPickBook(null); window.scrollTo({ top: 0 }); router.replace(`/biblia?v=${version}&r=${ref}${params.get("plan") ? `&plan=${params.get("plan")}&day=${params.get("day")}` : ""}`, { scroll: false }); }
  function neighbour(dir: 1 | -1): string | null {
    const i = BOOKS.findIndex((b) => b.code === book);
    const c = chapterNo + dir;
    if (c >= 1 && c <= info.chapters) return `${book}.${c}`;
    const nb = BOOKS[i + dir];
    return nb ? `${nb.code}.${dir === 1 ? 1 : nb.chapters}` : null;
  }
  async function chooseVersion(id: string) { setVersion(id); setState((s) => (s ? { ...s, chosen: true } : s)); await saveReaderState({ version_id: id }).catch(() => undefined); }
  const toggle = (ref: string) => setSel((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : [...s, ref].sort((a, b) => Number(a.split(".")[2]) - Number(b.split(".")[2]))));

  async function setReadFor(refs: string[], on: boolean) {
    const before = read;
    setRead((s) => { const n = new Set(s); for (const r of refs) { if (on) n.add(r); else n.delete(r); } return n; });
    try {
      if (on) await markRead({ refs }); else await unmarkRead({ refs });
      getReadProgress().then(setProgress).catch(() => undefined);
      flash(t(on ? "reader.marked" : "reader.unmarked"));
    } catch { setRead(before); setError(true); }
  }
  async function toggleChapterRead() {
    const on = !chapterRead;
    const before = read;
    setRead((s) => { const n = new Set(s); for (const r of chapterRefs) { if (on) n.add(r); else n.delete(r); } return n; });
    try { if (on) await markRead({ chapters: [chapter] }); else await unmarkRead({ chapter }); getReadProgress().then(setProgress).catch(() => undefined); flash(t(on ? "reader.marked" : "reader.unmarked")); } catch { setRead(before); }
  }
  const chosenVerses = () => (verses ?? []).filter((v) => sel.includes(v.ref));
  async function share() {
    const text = shareText(chosenVerses(), versionName);
    const r = await getPlatform().share.share({ title: labelOf(sel), text, url: window.location.origin });
    if (r !== "unavailable") flash(t(r === "copied" ? "reader.copied" : "reader.shared"));
  }
  async function copy() { const ok = await getPlatform().share.copyText?.(shareText(chosenVerses(), versionName)); if (ok) flash(t("reader.copied")); }
  async function favorite() { try { await Promise.all(sel.slice(0, 10).map((r) => addBookmark(r, version))); flash(t("reader.favorited")); } catch { setError(true); } }
  async function planDone() {
    if (!plan) return;
    await setPlanDay(plan.plan.id, plan.day, true).catch(() => undefined);
    flash(t("reader.plan.done"));
    getReadingPlan(plan.plan.id).then((r) => { setPlan({ plan: r.plan, day: plan.day }); void getBookReads(book).then((x) => setRead(new Set(x.refs))); getReadProgress().then(setProgress).catch(() => undefined); }).catch(() => undefined);
  }

  const notesByVerse = useMemo(() => {
    const m = new Map<string, VerseNote[]>();
    for (const n of notes) { const a = Number(n.ref_start.split(".")[2]), z = Number(n.ref_end.split(".")[2]); for (let v = a; v <= z; v++) { const k = `${book}.${chapterNo}.${v}`; m.set(k, [...(m.get(k) ?? []), n]); } }
    return m;
  }, [notes, book, chapterNo]);

  // first visit: the student chooses the Bible version
  if (state && !state.chosen && !params.get("v") && version) {
    const byLang = new Map<string, BibleVersionInfo[]>();
    for (const v of versions) byLang.set(v.language, [...(byLang.get(v.language) ?? []), v]);
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
        <h1 className="text-3xl">{t("reader.version.choose")}</h1>
        <p className="text-muted">{t("reader.version.hint")}</p>
        {[...byLang.entries()].map(([lang, list]) => (
          <section key={lang} aria-label={langName(lang)} className="flex flex-col gap-2">
            <h2 className="text-lg">{langName(lang)}</h2>
            {list.map((v) => <button key={v.id} type="button" className={`min-h-11 rounded-control border px-3 text-left ${v.id === version ? "border-primary" : "border-line"}`} onClick={() => void chooseVersion(v.id)}>{v.name} <span className="text-xs text-muted">({v.abbreviation})</span></button>)}
          </section>
        ))}
      </main>
    );
  }
  if (!state || !chapter) return error ? <main className="p-4"><Toast>{t("reader.error")}</Toast></main> : <p role="status" className="p-4 text-muted">{t("common.loading")}</p>;

  const prev = neighbour(-1), next = neighbour(1);
  const planChapters = plan?.plan.schedule.find((d) => d.day === plan.day)?.chapters ?? [];
  const dayDone = plan?.plan.done_days.includes(plan.day);
  const grouped = new Map<string, BibleVersionInfo[]>();
  for (const v of versions) grouped.set(v.language, [...(grouped.get(v.language) ?? []), v]);
  const versionOptions = [...grouped.entries()].map(([lang, list]) => <optgroup key={lang} label={langName(lang)}>{list.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-40">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="sr-only">{t("reader.title")}</h1>
          <label className="flex flex-col text-xs text-muted">{t("reader.version")}
            <select className={select} value={version} onChange={(e) => void chooseVersion(e.target.value)} aria-label={t("reader.version")}>{versionOptions}</select>
          </label>
          <Button type="button" variant="ghost" onClick={() => { setPicker(true); setPickBook(null); }} aria-haspopup="dialog">{info?.pt ?? book} {chapterNo} ▾</Button>
          <div className="ml-auto flex gap-1" role="group" aria-label={t("reader.title")}>
            <button type="button" className="min-h-11 min-w-11 rounded-control border border-line" aria-label={t("reader.font.down")} onClick={() => { const f = Math.max(0.8, +(font - 0.1).toFixed(1)); setFont(f); void saveReaderState({ font_scale: f }).catch(() => undefined); }}>A−</button>
            <button type="button" className="min-h-11 min-w-11 rounded-control border border-line" aria-label={t("reader.font.up")} onClick={() => { const f = Math.min(2, +(font + 0.1).toFixed(1)); setFont(f); void saveReaderState({ font_scale: f }).catch(() => undefined); }}>A+</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1 text-muted">{t("reader.compare")}
            <select className="min-h-9 rounded-control border border-line bg-surface px-2 text-sm text-ink" value={compare ?? ""} onChange={(e) => { const v = e.target.value || null; setCompare(v); void saveReaderState({ compare_version_id: v }).catch(() => undefined); }}>
              <option value="">{t("reader.compare.none")}</option>{versionOptions}
            </select>
          </label>
          <Link href="/biblia/planos" className="underline">{t("reader.links.plans")}</Link>
          <Link href="/biblia/anotacoes" className="underline">{t("reader.links.notes")}</Link>
        </div>
        {progress && (
          <div className="text-xs text-muted" aria-label={t("reader.progress").replace("{n}", String(biblePct))}>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line"><div className="h-full bg-primary" style={{ width: `${biblePct}%` }} /></div>
            {t("reader.progress").replace("{n}", String(biblePct))} · {info?.pt}: {t("reader.book.progress").replace("{n}", String(bookPct))}
          </div>
        )}
      </header>

      {plan && (
        <div className="rounded-card border border-primary p-3 text-sm" data-testid="plan-banner">
          <strong>{t("reader.plan.today").replace("{name}", plan.plan.name).replace("{n}", String(plan.day))}</strong>
          <p className="mt-1 flex flex-wrap gap-2">{planChapters.map((c) => <button key={c} type="button" className={`rounded-control border px-2 py-1 ${c === chapter ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => go(c)}>{formatRefPt(c)}</button>)}</p>
          {dayDone ? <p className="mt-2 text-ok-ink">✓ {t("reader.plan.done")}</p> : <Button className="mt-2" type="button" onClick={() => void planDone()}>{t("reader.plan.mark")}</Button>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl">{info?.pt} {chapterNo}{chapterRead && <span className="ml-2 text-sm text-ok-ink" title={t("reader.chapter.read")}>✓ {t("reader.tag.read")}</span>}</h2>
        <Button type="button" variant={chapterRead ? "ghost" : "accent"} onClick={() => void toggleChapterRead()}>{t(chapterRead ? "reader.unmark.chapter" : "reader.mark.chapter")}</Button>
      </div>

      {error && <Toast>{t("reader.error")} <button type="button" className="underline" onClick={() => { setError(false); setChapter(`${chapter}`); }}>{t("reader.retry")}</button></Toast>}
      {toast && <Toast tone="ok">{toast}</Toast>}
      {!verses && !error && <p role="status" className="text-muted">{t("reader.loading")}</p>}
      {verses && sel.length === 0 && <p className="text-xs text-muted">{t("reader.select.hint")}</p>}

      <article lang={version.startsWith("grc") ? "el" : version.startsWith("heb") ? "he" : undefined} className="flex flex-col gap-1 leading-relaxed" style={{ fontSize: `${font}rem` }} data-testid="chapter-text">
        {verses?.map((v) => {
          const on = sel.includes(v.ref), isRead = read.has(v.ref), n = notesByVerse.get(v.ref) ?? [];
          const mark = n.find((x) => x.color)?.color;
          return (
            <div key={v.ref} id={`v-${v.ref}`}>
              <button type="button" aria-pressed={on} onClick={() => toggle(v.ref)} className={`w-full rounded-control px-2 py-1 text-left ${on ? "bg-accent/30 outline outline-2 outline-primary" : mark ? COLOR_CLASS[mark] : ""} ${isRead && !on ? "opacity-80" : ""}`}>
                <sup className="mr-1 font-bold text-muted">{v.ref.split(".")[2]}</sup>{v.text}
                {isRead && <span className="ml-1 text-xs text-ok-ink" aria-label={t("reader.tag.read")}>✓</span>}
              </button>
              {other[v.ref] && <p className="px-2 pb-1 text-[0.9em] text-muted">{other[v.ref]}</p>}
              {n.length > 0 && <div className="flex flex-wrap gap-1 px-2 pb-1">{n.map((x) => <button key={x.id} type="button" className="rounded-control border border-line px-2 py-0.5 text-xs" onClick={() => setNoting({ note: x, refs: [x.ref_start, x.ref_end] })}>📝 {x.context ? `${x.context}: ` : ""}{x.text.slice(0, 40)}{x.text.length > 40 ? "…" : ""}</button>)}</div>}
            </div>
          );
        })}
      </article>

      <nav className="flex justify-between gap-2" aria-label={t("reader.book")}>
        <Button type="button" variant="ghost" disabled={!prev} onClick={() => prev && go(prev)}>← {t("reader.prev")}</Button>
        <Button type="button" variant="ghost" disabled={!next} onClick={() => next && go(next)}>{t("reader.next")} →</Button>
      </nav>

      {sel.length > 0 && (
        <div role="toolbar" aria-label={labelOf(sel)} className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-2xl flex-wrap items-center gap-2 border-t border-line bg-surface p-2 shadow-[var(--shadow)]" data-testid="verse-actions">
          <span className="px-1 text-sm font-semibold">{labelOf(sel)}</span>
          <Button type="button" onClick={() => setHelp(true)}>{t("reader.act.understand")}</Button>
          <Button type="button" variant="ghost" onClick={() => void setReadFor(sel, !sel.every((r) => read.has(r)))}>{sel.every((r) => read.has(r)) ? t("reader.unmark.verse") : t("reader.mark.verse")}</Button>
          <Button type="button" variant="ghost" onClick={() => setNoting({ refs: sel })}>{t("reader.act.note")}</Button>
          <Button type="button" variant="ghost" onClick={() => void share()}>{t("reader.act.share")}</Button>
          {getPlatform().share.copyText && <Button type="button" variant="ghost" onClick={() => void copy()}>{t("reader.act.copy")}</Button>}
          <Button type="button" variant="ghost" onClick={() => void favorite()}>{t("reader.act.favorite")}</Button>
          <button type="button" className="px-2 text-sm underline" onClick={() => setSel([])}>{t("reader.act.clear")}</button>
        </div>
      )}

      {help && <HelpPanel versionId={version} refs={sel} onClose={() => setHelp(false)} />}
      {noting && <NoteForm versionId={version} refs={noting.refs} note={noting.note} knownContexts={contexts} onClose={() => setNoting(null)} onSaved={() => { setNoting(null); setSel([]); loadNotes(); flash(t("note.saved")); }} />}

      {picker && (
        <Modal title={t("reader.book")} onClose={() => { setPicker(false); setPickBook(null); }}>
          {pickBook === null ? (
            <div className="flex flex-col gap-3">
              {[[t("reader.testament.ot"), BOOKS.slice(0, NT_START)], [t("reader.testament.nt"), BOOKS.slice(NT_START)]].map(([label, list]) => (
                <section key={label as string} aria-label={label as string}>
                  <h3 className="mb-1 text-lg">{label as string}</h3>
                  <div className="grid grid-cols-2 gap-1">{(list as typeof BOOKS).map((b) => <button key={b.code} type="button" className="min-h-11 rounded-control border border-line px-2 text-left" onClick={() => setPickBook(b.code)}>{b.pt}</button>)}</div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button type="button" className="self-start text-sm underline" onClick={() => setPickBook(null)}>← {BOOK_BY_CODE[pickBook].pt}</button>
              <div className="grid grid-cols-6 gap-1">{Array.from({ length: BOOK_BY_CODE[pickBook].chapters }, (_, i) => <button key={i} type="button" aria-label={`${t("reader.chapter")} ${i + 1}`} className="min-h-11 rounded-control border border-line" onClick={() => go(`${pickBook}.${i + 1}`)}>{i + 1}</button>)}</div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}

export default function ReaderPage() {
  return <Suspense fallback={<p role="status" className="p-4 text-muted">…</p>}><ReaderInner /></Suspense>;
}
