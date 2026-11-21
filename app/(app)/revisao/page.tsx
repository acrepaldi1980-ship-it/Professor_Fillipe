"use client";

// Review by voice (RF-M09-03): the teacher asks in a conversational tone, listens (voice or text), grades wrong/partial/right with a
// short reply, and the card is rescheduled (SM-2).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { getDueCards, gradeCard, transcribeAudio, type DueCard } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { getPlatform } from "@/lib/platform";
import { speakText, stopSpeaking } from "@/lib/voice/client-speak";

export default function ReviewPage() {
  const [cards, setCards] = useState<DueCard[] | null>(null);
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ verdict: "wrong" | "partial" | "right"; feedback: string; expected: string; nextInDays: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(false);
  const [level, setLevel] = useState(0);
  const [noVoice, setNoVoice] = useState(false);

  useEffect(() => { void getDueCards(20).then((r) => setCards(r.cards)).catch(() => setCards([])); }, []);
  useEffect(() => () => stopSpeaking(), []);

  const card = cards?.[i];
  const ask = useCallback((c: DueCard) => { void speakText(`${t("review.ask.prefix")}${c.question}`, setLevel).then((ok) => { if (!ok) setNoVoice(true); }); }, []);
  useEffect(() => { if (started && card && !result) ask(card); }, [started, card, result, ask]);

  async function submit(text: string) {
    if (!card) return;
    setBusy(true); setError(false); stopSpeaking();
    try {
      const r = await gradeCard(card.id, text);
      setResult(r);
      void speakText(r.feedback, setLevel);
    } catch { setError(true); }
    setBusy(false);
  }

  async function toggleMic() {
    const mic = getPlatform().microphone;
    if (recording) {
      setRecording(false); setBusy(true);
      try { const { text } = await transcribeAudio(await mic.stop()); if (text) { setAnswer(text); await submit(text); } else setBusy(false); } catch { setError(true); setBusy(false); }
      return;
    }
    stopSpeaking();
    try { await mic.start(); setRecording(true); } catch { setError(true); }
  }

  function next() { setResult(null); setAnswer(""); setI((n) => n + 1); }

  if (!cards) return <p role="status" className="grid min-h-dvh place-items-center text-muted">{t("common.loading")}</p>;
  if (cards.length === 0) return <main className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"><Avatar state="happy" size={96} /><h1 className="text-2xl">{t("review.title")}</h1><p className="text-muted">{t("review.empty")}</p><Link className="underline" href="/inicio">{t("closing.home")}</Link></main>;
  if (!started) return <main className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"><Avatar state="happy" size={96} /><h1 className="text-2xl">{t("review.title")}</h1><p>{t("home.review.due").replace("{n}", String(cards.length))}</p><Button type="button" onClick={() => { getPlatform().speech.unlock(); setStarted(true); }}>{t("review.start")}</Button></main>;
  if (!card) return <main className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"><Avatar state="happy" size={96} /><p>{t("review.done")}</p><Link className="underline" href="/inicio">{t("closing.home")}</Link></main>;
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-4 pb-24">
      <p className="text-center text-sm text-muted">{t("review.progress").replace("{n}", String(i + 1)).replace("{total}", String(cards.length))}</p>
      <div className="flex justify-center"><Avatar state={result ? (result.verdict === "right" ? "happy" : "empathetic") : recording ? "listening" : "speaking"} level={level} size={120} /></div>
      <p className="rounded-control bg-surface p-3 text-lg" aria-live="polite">{card.question}</p>
      {!result && (
        <>
          <textarea className="min-h-24 rounded-control border border-line bg-surface p-2" placeholder={t("review.answer.placeholder")} aria-label={t("review.answer.placeholder")} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="flex gap-2">
            <Button type="button" disabled={busy || !answer.trim()} onClick={() => void submit(answer.trim())}>{t("review.send")}</Button>
            <Button type="button" variant="ghost" disabled={busy && !recording} onClick={() => void toggleMic()}>{recording ? t("review.mic.stop") : t("review.mic")}</Button>
            <Button type="button" variant="ghost" onClick={() => ask(card)}>{t("review.listen")}</Button>
          </div>
        </>
      )}
      {noVoice && <Toast>{t("study.error.malevoice")}</Toast>}
      {error && <Toast>{t("review.error")}</Toast>}
      {result && (
        <div className="flex flex-col gap-2" role="status">
          <p className={`rounded-control border p-3 ${result.verdict === "right" ? "border-primary" : "border-line"}`}><strong>{t(`review.verdict.${result.verdict}`)}.</strong> {result.feedback}</p>
          {result.verdict !== "right" && <p className="text-sm text-muted">{t("review.expected")}: {result.expected}</p>}
          <p className="text-sm text-muted">{t("review.next.in").replace("{n}", String(result.nextInDays))}</p>
          <Button type="button" onClick={next}>{t("review.next")}</Button>
        </div>
      )}
    </main>
  );
}
