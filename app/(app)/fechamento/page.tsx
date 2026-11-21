"use client";

// Session closing (RF-M09-01): spoken summary (the teacher's voice), mind map diagram and the new review cards.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MindMapView } from "@/components/review/MindMapView";
import { ShareCardButton } from "@/components/share/ShareCardButton";
import { Avatar } from "@/components/teacher/Avatar";
import { SessionFeedback } from "@/components/teacher/SessionFeedback";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { closeSessionFull, getClosing, type ClosingData } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { speakText, stopSpeaking } from "@/lib/voice/client-speak";

export default function ClosingPage() {
  const [data, setData] = useState<ClosingData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const id = new URLSearchParams(window.location.search).get("s");
    if (!id) return setState("none");
    void (async () => {
      try {
        // already closed (reopened from the notebook)? show it; otherwise close now (generates the summary, map and cards)
        const existing = await getClosing(id).catch(() => null);
        if (existing) { setData(existing); return setState("ready"); }
        const r = await closeSessionFull(id);
        if (!r.closed) return setState("none");
        setData(await getClosing(id));
        setState("ready");
      } catch {
        setState("none");
      }
    })();
    return () => stopSpeaking();
  }, []);

  async function listen() {
    if (!data) return;
    setSpeaking(true);
    try { if (!(await speakText(data.summary))) setNoVoice(true); } finally { setSpeaking(false); }
  }

  if (state === "loading") return <main className="grid min-h-dvh place-items-center p-6"><div className="flex flex-col items-center gap-3 text-center"><Avatar state="thinking" size={88} /><p role="status" className="text-muted">{t("closing.loading")}</p></div></main>;
  if (state === "none" || !data) return <main className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"><Avatar state="happy" size={88} /><p>{t("closing.none")}</p><Link className="underline" href="/inicio">{t("closing.home")}</Link></main>;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center gap-3 pt-2"><Avatar state={speaking ? "speaking" : "happy"} size={64} /><h1 className="text-2xl">{t("closing.title")}</h1></div>
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("closing.summary")}</h2>
        <p className="whitespace-pre-line">{data.summary}</p>
        <Link href="/conta" className="mt-1 block text-sm underline">{t("notify.closing")}</Link>
        <ShareCardButton text={data.summary} title={t("share.card.learned")} className="mt-2" />
        {noVoice && <p role="alert" className="text-sm text-muted">{t("study.error.malevoice")}</p>}
        <div><Button type="button" onClick={() => (speaking ? (stopSpeaking(), setSpeaking(false)) : void listen())}>{speaking ? t("closing.stop") : t("closing.listen")}</Button></div>
      </Card>
      <section><h2 className="mb-2 text-lg">{t("closing.map")}</h2><MindMapView map={data.mind_map} /></section>
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg">{t("closing.cards")}</h2>
        <p className="text-sm text-muted">{t("closing.cards.help").replace("{n}", String(data.cards.length))}</p>
        <ul className="list-disc pl-5 text-sm">{data.cards.map((c) => <li key={c.id}>{c.question}</li>)}</ul>
        <div className="flex flex-wrap gap-2"><Link href="/revisao" className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-primary-ink">{t("closing.review")}</Link><Link href="/caderno" className="inline-flex min-h-11 items-center rounded-control border border-line px-4">{t("closing.notebook")}</Link></div>
      </Card>
      <SessionFeedback sessionId={new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("s") ?? ""} />
    </main>
  );
}
