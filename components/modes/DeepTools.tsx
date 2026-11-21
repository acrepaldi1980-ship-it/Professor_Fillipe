"use client";

// Advanced Aprofundar tools (spec 8.7.4 P1): interlinear with morphology in Portuguese and pronunciation, word study (lexicon, senses, occurrences, how
// the versions render it) and comparison of versions side by side with the differences marked and explained.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { compareVersions, explainVersions, getInterlinear, getWordStudy, type CompareData, type IlWord, type WordStudyData } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { findReferences, formatRefPt } from "@/lib/knowledge/refs-parser";
import { speakText, stopSpeaking } from "@/lib/voice/client-speak";

export const VERSION_NAMES: Record<string, string> = { por_blivre_2018: "Bíblia Livre 2018", por_nbv_open: "NBV (aberta)", por_mundial: "Mundial", eng_kjv: "King James", eng_bsb: "Berean Standard", eng_web: "World English", eng_asv_1901: "American Standard 1901", spa_rv_1909: "Reina-Valera 1909", lat_vulgata_clementina: "Vulgata Clementina", grc_tr: "Textus Receptus (grego)", heb_wlc: "Westminster Leningrad (hebraico)" };

/** The pronunciation is the transliteration read with the teacher's (male) voice: an approximation in Portuguese, said on the screen. */
export function speakable(translit: string | null | undefined): string {
  return (translit ?? "").replace(/[ēĒ]/g, "e").replace(/[ōŌ]/g, "o").replace(/[āĀ]/g, "a").replace(/[īĪ]/g, "i").replace(/[ūŪ]/g, "u").replace(/['`]/g, "").replace(/[./\\]+/g, " ").replace(/\s+/g, " ").trim();
}

const firstRef = (passage?: string) => { try { return findReferences(passage ?? "").flatMap((r) => r.refs)[0] ?? ""; } catch { return ""; } };

function WordModal({ strong, onClose, onOpenRef }: { strong: string; onClose(): void; onOpenRef?(ref: string): void }) {
  const [data, setData] = useState<WordStudyData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void getWordStudy(strong).then(setData).catch(() => setError(true)); }, [strong]);
  const max = useMemo(() => Math.max(1, ...(data?.senses.map((s) => s.n) ?? [1])), [data]);
  return (
    <Modal title={data?.lemma ? `${data.lemma} (${strong})` : strong} onClose={onClose}>
      {error && <p role="alert">{t("word.error")}</p>}
      {!data && !error && <p role="status" className="text-muted">{t("word.loading")}</p>}
      {data && (
        <div className="flex flex-col gap-3 text-sm">
          <p><strong>{t("word.occurrences").replace("{n}", String(data.occurrences))}</strong></p>
          {data.entries.map((e, i) => <div key={i}><p className="text-xs font-semibold text-muted">{e.source}</p><p className="whitespace-pre-line">{e.definition}</p></div>)}
          <div><h3 className="font-semibold">{t("word.senses")}</h3><p className="text-xs text-muted">{t("word.senses.help")}</p>
            <ul className="mt-1 flex flex-col gap-1">{data.senses.map((s) => <li key={s.gloss} className="flex items-center gap-2"><span className="w-28 shrink-0 truncate">{s.gloss}</span><span className="h-2 rounded bg-primary" style={{ width: `${Math.max(4, (s.n / max) * 100)}%` }} /><span className="text-xs text-muted">{s.n}</span></li>)}</ul></div>
          <div><h3 className="font-semibold">{t("word.renderings")}</h3><p className="text-xs text-muted">{t("word.renderings.help")}</p>
            <ul className="mt-1 flex flex-col gap-2">{data.renderings.map((r) => <li key={r.ref} className="rounded-control border border-line p-2"><button type="button" className="font-semibold underline" onClick={() => onOpenRef?.(r.ref)}>{formatRefPt(r.ref)}</button>{data.versions.map((v) => r.texts[v] ? <p key={v}><span className="text-xs text-muted">{VERSION_NAMES[v] ?? v}: </span>{r.texts[v]}</p> : null)}</li>)}</ul></div>
          <p className="text-xs text-muted">{data.source}</p>
        </div>
      )}
      <div className="mt-3"><Button type="button" variant="ghost" onClick={onClose}>{t("study.verse.close")}</Button></div>
    </Modal>
  );
}

export function InterlinearTab({ passage, onOpenRef }: { passage?: string; onOpenRef?(ref: string): void }) {
  const [ref, setRef] = useState(firstRef(passage));
  const [verses, setVerses] = useState<{ ref: string; words: IlWord[] }[] | null>(null);
  const [error, setError] = useState(false);
  const [word, setWord] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  useEffect(() => { setRef(firstRef(passage)); }, [passage]);
  useEffect(() => {
    if (!ref) return;
    setVerses(null); setError(false);
    void getInterlinear(ref).then((r) => setVerses(r.verses.slice(0, 12))).catch(() => setError(true));
  }, [ref]);
  async function say(w: IlWord) {
    stopSpeaking();
    setSpeaking(`${w.ref}.${w.position}`);
    try { await speakText(speakable(w.translit)); } finally { setSpeaking(null); }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">{t("il.help")}</p>
      {error && <p role="alert" className="text-sm">{t("il.error")}</p>}
      {!verses && !error && ref && <p role="status" className="text-sm text-muted">{t("word.loading")}</p>}
      {!ref && <p className="text-sm text-muted">{t("il.noref")}</p>}
      {verses?.map((v) => (
        <section key={v.ref} aria-label={formatRefPt(v.ref)} className="flex flex-col gap-1">
          <button type="button" className="self-start text-sm font-semibold underline" onClick={() => onOpenRef?.(v.ref)}>{formatRefPt(v.ref)}</button>
          <ul className={`flex flex-wrap gap-2 ${v.words[0]?.lang === "heb" ? "flex-row-reverse" : ""}`} dir={v.words[0]?.lang === "heb" ? "rtl" : "ltr"}>
            {v.words.map((w) => (
              <li key={w.position} dir="ltr" className="flex w-32 flex-col gap-0.5 rounded-control border border-line bg-bg p-2 text-sm" data-testid="il-word">
                <span lang={w.lang === "heb" ? "he" : "grc"} className="text-lg">{w.surface.replace(/\\/g, "")}</span>
                <span className="text-muted">{w.translit}</span>
                <span><strong>{w.gloss}</strong></span>
                {w.morphPt && <span className="text-xs text-muted">{w.morphPt.text}</span>}
                <span className="mt-1 flex gap-2 text-xs">
                  {w.strong && <button type="button" className="underline" onClick={() => setWord(w.strong)}>{t("il.word")} {w.strong}</button>}
                  <button type="button" className="underline" aria-label={`${t("il.listen")} ${w.translit}`} onClick={() => void say(w)}>{speaking === `${w.ref}.${w.position}` ? "…" : "🔊"}</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {verses && <p className="text-xs text-muted">{t("il.pronunciation")}</p>}
      {word && <WordModal strong={word} onClose={() => setWord(null)} onOpenRef={onOpenRef} />}
    </div>
  );
}

export function VersionsTab({ passage }: { passage?: string }) {
  const [ref, setRef] = useState(() => { const r = firstRef(passage); return r.split("-")[0]; });
  const [chosen, setChosen] = useState<string[]>(["por_blivre_2018", "por_nbv_open"]);
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState(false);
  const [explain, setExplain] = useState<{ summary: string; points: { difference: string; reason: string }[]; source: string } | null>(null);
  const [explainError, setExplainError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRef(firstRef(passage).split("-")[0]); }, [passage]);
  useEffect(() => {
    if (!ref || chosen.length < 2) return;
    setData(null); setError(false); setExplain(null);
    void compareVersions(ref, chosen).then(setData).catch(() => setError(true));
  }, [ref, chosen]);
  async function why() {
    setBusy(true); setExplainError(false);
    try { setExplain(await explainVersions(ref, chosen)); } catch { setExplainError(true); }
    setBusy(false);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">{t("ver.help")}</p>
      <div role="group" aria-label={t("ver.choose")} className="flex flex-wrap gap-2">
        {Object.entries(VERSION_NAMES).filter(([id]) => !id.startsWith("grc_") && !id.startsWith("heb_")).map(([id, name]) => (
          <button key={id} type="button" aria-pressed={chosen.includes(id)} onClick={() => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 4 ? [...c, id] : c))} className={`min-h-9 rounded-control border px-3 text-sm ${chosen.includes(id) ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{name}</button>
        ))}
      </div>
      {chosen.length < 2 && <p className="text-sm text-muted">{t("ver.two")}</p>}
      {error && <p role="alert" className="text-sm">{t("il.error")}</p>}
      {data?.verses.map((v) => (
        <section key={v.ref} aria-label={formatRefPt(v.ref)} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{formatRefPt(v.ref)}</h3>
          <p className="rounded-control border border-line p-2 text-sm"><span className="text-xs text-muted">{VERSION_NAMES[v.base.version] ?? v.base.version}: </span>{v.base.text}</p>
          {v.others.map((o) => (
            <p key={o.version} className="rounded-control border border-line p-2 text-sm"><span className="text-xs text-muted">{VERSION_NAMES[o.version] ?? o.version}: </span>
              {o.segments ? o.segments.map((s, i) => <span key={i} className={s.changed ? "rounded bg-primary/20 px-0.5 font-semibold" : ""}>{s.text} </span>) : <em className="text-muted">{t("ver.missing")}</em>}</p>
          ))}
        </section>
      ))}
      {data && <div><Button type="button" variant="ghost" disabled={busy} onClick={() => void why()}>{busy ? t("doc.gap.working") : t("ver.explain")}</Button></div>}
      {explainError && <p role="alert" className="text-sm text-muted">{t("doc.gap.error")}</p>}
      {explain && (
        <div className="rounded-control border border-line p-3 text-sm" data-testid="ver-explain">
          <p className="font-semibold">{explain.summary}</p>
          <ul className="mt-1 list-disc pl-5">{explain.points.map((p, i) => <li key={i}><strong>{p.difference}</strong> {p.reason}</li>)}</ul>
          <p className="mt-2 text-xs text-muted">{explain.source}</p>
        </div>
      )}
    </div>
  );
}
