"use client";

// Ensaio do sermão (spec 8.7.5): the preacher rehearses aloud, the app transcribes, measures and gives feedback (3 strengths, up to 3
// improvements), and compares rehearsals of the same outline. The audio is deleted after the analysis unless the preacher chooses to keep it.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { analyzeRehearsal, ApiError, deleteRehearsal, getMe, getRehearsal, listRehearsals, saveConsent, type Rehearsal } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { compareRehearsals, fmtTime, paceLabel, WPM_RANGE, type Metrics, type PartTime } from "@/lib/rehearsal/analyze";

const MAX_SECONDS = 20 * 60;
const BITRATE = 24000; // speech only: 20 min stays under the 4.5 MB request limit
const asLite = (r: Rehearsal) => ({ id: r.id, created_at: r.created_at, metrics: r.metrics as unknown as Metrics, feedback: r.feedback as never, parts: r.metrics.parts as PartTime[] | undefined });
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const Score = ({ n }: { n?: number }) => (n ? <span className="rounded bg-primary/15 px-1.5 text-xs font-semibold" aria-label={`${n} de 5`}>{n}/5</span> : null);

export function RehearsalPanel({ sessionId }: { sessionId: string }) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "analyzing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Rehearsal[]>([]);
  const [current, setCurrent] = useState<Rehearsal | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const off = useRef<(() => void) | null>(null);
  const mic = getPlatform().microphone;

  const refresh = () => void listRehearsals(sessionId).then((r) => setItems(r.items)).catch(() => undefined);
  useEffect(() => { void getMe().then((m) => setConsent(!!m.consents.rehearsal_audio?.granted)).catch(() => setConsent(false)); refresh(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); off.current?.(); }, []);

  async function grant() { try { await saveConsent("rehearsal_audio", true); setConsent(true); } catch { setError("generic"); } }

  async function start() {
    setError(null); setCurrent(null);
    try {
      await mic.start({ bitsPerSecond: BITRATE });
    } catch { setError("mic"); return; }
    setSeconds(0); setPhase("recording");
    off.current = mic.onLevel(setLevel);
    const t0 = Date.now();
    timer.current = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); setSeconds(s); if (s >= MAX_SECONDS) void stop(); }, 500);
  }

  async function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    off.current?.(); off.current = null;
    setPhase("analyzing");
    const blob = await mic.stop();
    try {
      const r = await analyzeRehearsal(sessionId, blob, keep);
      setCurrent(r); refresh();
    } catch (e) {
      const code = e instanceof ApiError ? String(e.data.error ?? e.status) : "generic";
      setError(code === "too_short_or_unclear" || code === "audio_too_large" || code === "no_outline" || code === "outline_empty" || code === "consent_required" || code === "plan_required" || code === "rate_limited" ? code : "generic");
    }
    setPhase("idle");
  }

  async function open(id: string) { try { setCurrent(await getRehearsal(id)); setError(null); } catch { setError("generic"); } }
  async function remove(id: string) { try { await deleteRehearsal(id); if (current?.id === id) setCurrent(null); setPick((p) => p.filter((x) => x !== id)); refresh(); } catch { setError("generic"); } }
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  if (consent === null) return <p role="status" className="text-sm text-muted">{t("word.loading")}</p>;
  if (!consent) {
    return (
      <div className="flex flex-col gap-2 text-sm" data-testid="reh-consent">
        <h3 className="font-semibold">{t("reh.consent.title")}</h3>
        <p>{t("reh.consent.body")}</p>
        <div><Button type="button" onClick={() => void grant()}>{t("reh.consent.accept")}</Button></div>
        {error && <p role="alert">{t("reh.err.generic")}</p>}
      </div>
    );
  }

  const cmp = pick.length === 2 ? (() => { const [a, b] = pick.map((id) => items.find((i) => i.id === id)).filter(Boolean) as Rehearsal[]; const [first, second] = new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a]; return { first, second, ...compareRehearsals(asLite(first), asLite(second)) }; })() : null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted">{t("reh.help")}</p>
      {phase === "idle" && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{t("reh.keep")}</label>
          <div><Button type="button" onClick={() => void start()} disabled={!mic.isSupported()}>{t("reh.start")}</Button></div>
          {!mic.isSupported() && <p className="text-xs text-muted">{t("reh.err.mic")}</p>}
        </div>
      )}
      {phase === "recording" && (
        <div className="flex flex-col gap-2" role="status" aria-live="off">
          <p className="text-lg font-semibold" data-testid="reh-timer">{fmtTime(seconds)} <span className="text-xs font-normal text-muted">/ {fmtTime(MAX_SECONDS)}</span></p>
          <div className="h-2 w-full rounded bg-line"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, level * 140)}%` }} /></div>
          <div><Button type="button" onClick={() => void stop()}>{t("reh.stop")}</Button></div>
        </div>
      )}
      {phase === "analyzing" && <p role="status" className="text-muted">{t("reh.analyzing")}</p>}
      {error && <p role="alert">{t(`reh.err.${error}` as "reh.err.generic")}</p>}

      {current && <ResultView r={current} onRemove={() => void remove(current.id)} />}

      {!!items.length && (
        <section aria-label={t("reh.history")}>
          <h3 className="font-semibold">{t("reh.history")}</h3>
          <p className="text-xs text-muted">{t("reh.history.help")}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-control border border-line p-2">
                <input type="checkbox" aria-label={`${t("reh.compare.pick")} ${when(r.created_at)}`} checked={pick.includes(r.id)} onChange={() => toggle(r.id)} />
                <button type="button" className="flex-1 text-left underline" onClick={() => void open(r.id)}>{when(r.created_at)} · {fmtTime(r.duration_s)} · {r.metrics.wpm} {t("reh.wpm.unit")}</button>
                <button type="button" className="text-xs text-muted underline" onClick={() => void remove(r.id)}>{t("reh.delete")}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cmp && (
        <section aria-label={t("reh.compare")} className="rounded-control border border-line p-3" data-testid="reh-compare">
          <h3 className="font-semibold">{t("reh.compare")}: {when(cmp.first.created_at)} → {when(cmp.second.created_at)}</h3>
          <table className="mt-2 w-full text-left text-xs">
            <thead><tr><th scope="col">{t("reh.compare.metric")}</th><th scope="col">{t("reh.compare.before")}</th><th scope="col">{t("reh.compare.after")}</th></tr></thead>
            <tbody>{cmp.deltas.map((d) => {
              const show = (v: number | null) => (v === null ? "—" : d.label === "total" ? fmtTime(v) : `${v}${d.unit}`);
              const good = d.before !== null && d.after !== null && ((d.better === "up" && d.after > d.before) || (d.better === "down" && d.after < d.before));
              return <tr key={d.label}><th scope="row" className="font-normal">{t(`reh.m.${d.label}` as "reh.m.total")}</th><td>{show(d.before)}</td><td className={good ? "font-semibold text-primary" : ""}>{show(d.after)}{good ? " ↑" : ""}</td></tr>;
            })}</tbody>
          </table>
          {!!cmp.partDeltas.length && <details className="mt-2"><summary className="cursor-pointer text-xs">{t("reh.compare.parts")}</summary><ul className="mt-1 text-xs">{cmp.partDeltas.map((p) => <li key={p.label}>{p.label}: {p.before === null ? "—" : fmtTime(p.before)} → {p.after === null ? "—" : fmtTime(p.after)}</li>)}</ul></details>}
          {!!cmp.addressed.length && <div className="mt-2"><p className="text-xs font-semibold">{t("reh.compare.addressed")}</p><ul className="list-disc pl-5 text-xs">{cmp.addressed.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
        </section>
      )}
    </div>
  );
}

function ResultView({ r, onRemove }: { r: Rehearsal; onRemove(): void }) {
  const m = r.metrics, f = r.feedback;
  const pace = paceLabel(m.wpm);
  const planned = m.planned_minutes ? m.planned_minutes * 60 : null;
  const [playing, setPlaying] = useState(false);
  return (
    <article className="flex flex-col gap-3 rounded-control border border-line p-3" aria-label={t("reh.result")} data-testid="reh-result">
      <h3 className="font-semibold">{t("reh.result")} · {when(r.created_at)}</h3>
      <ul className="grid grid-cols-2 gap-2 text-xs">
        <li><strong>{fmtTime(m.total_seconds)}</strong> {t("reh.m.total")}{planned ? ` (${t("reh.planned")} ${fmtTime(planned)})` : ""}</li>
        <li><strong>{m.wpm}</strong> {t("reh.wpm.unit")} — {t(`reh.pace.${pace}` as "reh.pace.ok")} <span className="text-muted">({WPM_RANGE.low}–{WPM_RANGE.high})</span></li>
        <li><strong>{m.words}</strong> {t("reh.words")}</li>
        <li><strong>{m.pauses.count}</strong> {t("reh.pauses")}{m.pauses.count ? ` (${t("reh.longest")} ${m.pauses.longest_seconds}s)` : ""}</li>
      </ul>
      {!!m.parts?.length && (
        <div><h4 className="text-xs font-semibold">{t("reh.parts")}</h4>
          <ul className="text-xs">{m.parts.map((p) => <li key={p.key}>{p.label}: {p.found && p.seconds !== null ? `${fmtTime(p.seconds)} · ${p.words} ${t("reh.words")}` : <span className="text-muted">{t("reh.part.missing")}</span>}</li>)}</ul></div>
      )}
      {!!m.crutches.length && (
        <div><h4 className="text-xs font-semibold">{t("reh.crutches")}</h4>
          <p className="text-xs">{m.crutches.map((c) => `${c.word} ${c.count}×${c.flagged ? " ⚠" : ""}`).join(" · ")}</p>
          <p className="text-xs text-muted">{t("reh.crutches.note")}</p></div>
      )}
      {r.feedback_ok === false || !f.strengths ? <p className="text-xs text-muted">{t("reh.feedback.missing")}</p> : (
        <>
          <div><h4 className="font-semibold">{t("reh.strengths")}</h4><ul className="list-disc pl-5">{f.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          {!!f.improvements?.length && <div><h4 className="font-semibold">{t("reh.improvements")}</h4><ol className="list-decimal pl-5">{f.improvements.map((s, i) => <li key={i}><strong>{s.what}</strong> {s.how}</li>)}</ol></div>}
          <dl className="flex flex-col gap-1 text-xs">
            {f.central_idea && <div><dt className="inline font-semibold">{t("reh.central")} <Score n={f.central_idea.clarity} /></dt> <dd className="inline">{f.central_idea.stated_early ? t("reh.central.early") : t("reh.central.late")} {f.central_idea.comment}</dd></div>}
            {f.transitions && <div><dt className="inline font-semibold">{t("reh.m.transitions")} <Score n={f.transitions.score} /></dt> <dd className="inline">{f.transitions.comment}</dd></div>}
            {f.illustrations && <div><dt className="inline font-semibold">{t("reh.illustrations")}</dt> <dd className="inline">{f.illustrations.used.length ? `${f.illustrations.used.join("; ")}. ` : ""}{f.illustrations.comment}</dd></div>}
            {f.fidelity && <div><dt className="inline font-semibold">{t("reh.m.fidelity")} <Score n={f.fidelity.score} /></dt> <dd className="inline">{f.fidelity.comment}{f.fidelity.issues.length ? ` ${f.fidelity.issues.join(" ")}` : ""}</dd></div>}
          </dl>
          <p className="text-xs text-muted">{t("reh.ai.note")}</p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {r.audio_link && <Button type="button" variant="ghost" className="text-sm" disabled={playing} onClick={() => { setPlaying(true); void getPlatform().audioPlayer.play(r.audio_link!).finally(() => setPlaying(false)); }}>{t("reh.listen")}</Button>}
        <Button type="button" variant="ghost" className="text-sm" onClick={onRemove}>{t("reh.delete")}</Button>
      </div>
      <p className="text-xs text-muted">{r.has_audio || r.audio_link ? t("reh.audio.kept") : t("reh.audio.deleted")}</p>
    </article>
  );
}
