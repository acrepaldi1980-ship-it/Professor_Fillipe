"use client";

// Prototype study screen (Prompt 0.1, step 8): talk or type, hear the professor, read captions,
// tap reference chips and next-step buttons, interrupt at any time.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarState } from "@/components/teacher/Avatar";
import { AvatarArt } from "@/components/teacher/AvatarArt";
import { DocPanel } from "@/components/modes/DocPanel";
import { VisualPanel } from "@/components/visuals/VisualPanel";
import { Bubble } from "@/components/ui/Bubble";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { MiniMarkdown } from "@/components/ui/MiniMarkdown";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackEvent, isPlanBlock, addBookmark, closeSessionFull, createSession, flagAnswer, getBibleVerses, getMe, getSessionDocument, speakSentence, teacherTurn, transcribeAudio } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { findReferences, formatRefPt } from "@/lib/knowledge/refs-parser";
import { getPlatform } from "@/lib/platform";
import { loadPrefs } from "@/lib/prefs";
import type { TeacherResponse } from "@/lib/teacher/schema";
import { splitSentences } from "@/lib/voice/speech-text";

const CUE_STATE = { neutral: "idle", happy: "happy", surprised: "insight", thoughtful: "thinking", empathetic: "empathetic", pointing: "pointing" } as const satisfies Record<string, AvatarState>;

type Msg = { id: number; role: "user" | "teacher"; text: string; response?: TeacherResponse; messageId?: string };

const MAIN_VERSION = "por_blivre_2018";
const SILENCE_MS = 1200;
const SPEECH_LEVEL = 0.06;
const MAX_RECORD_MS = 30_000;

export default function StudyPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [state, setState] = useState<AvatarState>("idle");
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [textOnly, setTextOnly] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [verse, setVerse] = useState<{ title: string; ref?: string; lines: { ref: string; text: string }[] } | null>(null);
  const [marked, setMarked] = useState(false);
  const [planBlock, setPlanBlock] = useState<{ plan?: string } | null>(null);
  const [fair, setFair] = useState(false);
  const sessionId = useRef("");
  const firstLesson = useRef(false); // arrived from the welcome card (RF-M03-04)
  const firstFired = useRef(false);
  const themeRef = useRef<string | null>(null); // a topic suggested by the home screen (?tema=)
  const [sessionReady, setSessionReady] = useState(false);
  const [mode, setMode] = useState<string>("free");
  const [tab, setTab] = useState<"chat" | "doc">("chat");
  const [docKey, setDocKey] = useState(0);
  const [panel, setPanel] = useState<{ visual: TeacherResponse["visuals"][number]; durationMs: number } | null>(null);
  const nextId = useRef(1);
  const playId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // The conversation lives in a server-side session: /estudo?s=<id> (query string keeps the screen exportable for Capacitor).
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("primeira")) firstLesson.current = true;
    if (query.get("tema")) { firstLesson.current = true; themeRef.current = query.get("tema"); }
    const existing = query.get("s");
    if (existing) {
      sessionId.current = existing;
      setSessionReady(true);
      return;
    }
    void createSession("free")
      .then(({ sessionId: id }) => {
        sessionId.current = id;
        router.replace(`/estudo?s=${id}`);
        setSessionReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setDocKey((k) => k + 1); // the teacher may have filled a section of the document
  }, [messages]);
  // 10 minutes without a message closes the session by itself (RF-M09-01): summary, map and cards wait in the notebook.
  useEffect(() => {
    if (messages.length < 2) return;
    const h = window.setTimeout(() => void closeSessionFull(sessionId.current).catch(() => undefined), 10 * 60 * 1000);
    return () => clearTimeout(h);
  }, [messages]);
  useEffect(() => {
    if (sessionReady) void getSessionDocument(sessionId.current).then((d) => setMode(d.mode)).catch(() => undefined);
  }, [sessionReady]);
  useEffect(() => getPlatform().audioPlayer.onLevel(setLevel), []);

  const stopSpeaking = useCallback(() => {
    playId.current++;
    getPlatform().audioPlayer.stop();
    getPlatform().speech.cancel();
    setLevel(0);
    setState("idle");
  }, []);

  // Server voice (Gemini, the same family as the greeting video) first; if it is unavailable the device voice takes over for the rest.
  const serverVoice = useRef<"unknown" | "ok" | "down">("unknown");
  const speak = useCallback(async (speech: string, cue?: AvatarState) => {
    const my = ++playId.current;
    const sentences = splitSentences(speech);
    const platform = getPlatform();
    // stay in "thinking" until the first sound is really playing (the server voice can take a few seconds the first time)
    try {
      let next: Promise<Blob> | null = serverVoice.current !== "down" ? speakSentence(sentences[0]) : null;
      next?.catch(() => undefined);
      for (let i = 0; i < sentences.length; i++) {
        if (my !== playId.current) return;
        let played = false;
        if (next) {
          try {
            const blob = await next;
            if (my !== playId.current) return;
            serverVoice.current = "ok";
            next = i + 1 < sentences.length ? speakSentence(sentences[i + 1]) : null;
            next?.catch(() => undefined);
            setState("speaking");
            await platform.audioPlayer.play(blob); // the mouth follows the real audio level
            played = true;
          } catch {
            serverVoice.current = "down";
            next = null;
          }
        }
        if (!played && my === playId.current) {
          if (platform.speech.isSupported()) {
            setState("speaking");
            const voiceName = (await loadPrefs()).voiceName;
            let missing = false;
            await platform.speech.speak(sentences[i], { voiceName, onLevel: (lv) => my === playId.current && setLevel(lv), onUnavailable: () => { missing = true; } });
            if (missing) { setError(t("study.error.malevoice")); break; }
          } else setError(t("study.error.voice"));
        }
      }
    } catch {
      if (my === playId.current) setError(t("study.error.voice"));
    }
    if (my === playId.current) {
      setLevel(0);
      setState(cue ?? "idle");
    }
  }, []);

  const send = useCallback(
    async (text: string, intent?: string) => {
      const clean = text.trim();
      if (!clean) return;
      getPlatform().speech.unlock();
      stopSpeaking();
      setError(null);
      setMessages((m) => [...m, { id: nextId.current++, role: "user", text: clean }]);
      setState("thinking");
      try {
        const { response, meta } = await teacherTurn({ sessionId: sessionId.current, text: clean, intent });
        setFair(!!(meta as { fairUse?: boolean }).fairUse);
        setMessages((m) => [...m, { id: nextId.current++, role: "teacher", text: response.display_markdown || response.speech, response, messageId: meta.messageId }]);
        // The teacher opened a visual (RF-M08-01): the panel appears while the speech plays, and the map animates for its length.
        if (response.visuals.length) setPanel({ visual: response.visuals[0], durationMs: Math.round((response.speech.split(/\s+/).length / 2.6) * 1000) });
        if (response.pastoral_flag) setState("empathetic");
        const cue: AvatarState = response.pastoral_flag ? "empathetic" : response.avatar_cue && response.avatar_cue !== "neutral" ? CUE_STATE[response.avatar_cue] : response.visuals.length ? "pointing" : "idle";
        if (!textOnly) await speak(response.speech, cue);
        else setState(cue);
      } catch (e) {
        setState("idle");
        const msg = (e as Error).message;
        if (msg === "api_error_401") return router.replace("/login");
        if (isPlanBlock(e)) return setPlanBlock(e.data as { plan?: string });
        setError(msg === "api_error_503" ? t("study.error.unavailable") : msg === "api_error_429" ? t("study.error.limit") : t("study.error.turn"));
      }
    },
    [speak, stopSpeaking, textOnly, router],
  );

  // First lesson (RF-M03-04): a free-study session opens with the topic the student named in the interview.
  useEffect(() => {
    if (!sessionReady || !firstLesson.current || firstFired.current) return;
    firstFired.current = true;
    trackEvent("first_lesson_started");
    if (themeRef.current) return void send(t("study.first.ask").replace("{topic}", themeRef.current));
    void getMe().then((m) => {
      const topic = m.profile?.first_topic;
      if (topic) void send(t("study.first.ask").replace("{topic}", topic));
    });
  }, [sessionReady, send]);

  const stopRecordingAndSend = useCallback(async () => {
    setRecording(false);
    setState("thinking");
    try {
      const audio = await getPlatform().microphone.stop();
      const { text } = await transcribeAudio(audio);
      if (!text) throw new Error("empty");
      await send(text);
    } catch {
      setState("idle");
      setError(t("study.error.heard"));
    }
  }, [send]);

  const toggleMic = useCallback(async () => {
    const mic = getPlatform().microphone;
    if (recording) return void stopRecordingAndSend();
    stopSpeaking();
    setError(null);
    if (!mic.isSupported()) return setError(t("study.error.mic"));
    try {
      let heardSpeech = false;
      let lastVoice = Date.now();
      const started = Date.now();
      const off = mic.onLevel((lv) => {
        setLevel(lv);
        if (lv > SPEECH_LEVEL) {
          heardSpeech = true;
          lastVoice = Date.now();
        }
        const silent = Date.now() - lastVoice > SILENCE_MS;
        if ((heardSpeech && silent) || Date.now() - started > MAX_RECORD_MS) {
          off();
          void stopRecordingAndSend();
        }
      });
      await mic.start();
      setRecording(true);
      setState("listening");
    } catch {
      setError(t("study.error.mic"));
    }
  }, [recording, stopRecordingAndSend, stopSpeaking]);

  const openRef = useCallback(async (ref: string) => {
    // one automatic retry: a cold server or a brief network drop must not leave the student with an empty verse
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await getBibleVerses(MAIN_VERSION, ref);
        if (r.verses.length === 0 && attempt === 0) throw new Error("empty");
        setMarked(false);
        setVerse({ title: formatRefPt(ref), ref, lines: r.verses.length ? r.verses : [{ ref, text: t("study.verse.error") }] });
        return;
      } catch {
        if (attempt === 0) await new Promise((res) => setTimeout(res, 700));
      }
    }
    setMarked(false);
    setVerse({ title: formatRefPt(ref), ref, lines: [{ ref, text: t("study.verse.error") }] });
  }, []);

  const docMode = mode === "lesson" || mode === "sermon";
  const statusKey = recording ? "study.status.listening" : state === "thinking" ? "study.status.thinking" : state === "speaking" ? "study.status.speaking" : "study.status.idle";

  return (
    <main className={`mx-auto min-h-dvh px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] ${docMode ? "grid max-w-5xl gap-4 md:grid-cols-2" : "flex max-w-2xl flex-col"}`}>
      {docMode && (
        <div role="tablist" className="flex gap-2 pt-2 md:hidden md:col-span-2">
          <button role="tab" aria-selected={tab === "chat"} type="button" className={`min-h-11 flex-1 rounded-control border ${tab === "chat" ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => setTab("chat")}>{t("doc.tab.chat")}</button>
          <button role="tab" aria-selected={tab === "doc"} type="button" className={`min-h-11 flex-1 rounded-control border ${tab === "doc" ? "border-primary bg-primary text-primary-ink" : "border-line"}`} onClick={() => setTab("doc")}>{t("doc.tab.doc")}</button>
        </div>
      )}
      <div className={`flex min-w-0 flex-col ${docMode && tab === "doc" ? "hidden md:flex" : ""}`}>
      <header className="flex flex-col items-center gap-1 py-2">
        <div className="h-[46dvh] max-h-[460px] min-h-[260px] w-full max-w-sm">
          {greeting ? (
            <div className="avatar-stage flex h-full w-full items-center justify-center">
              <video src="/avatar/boas-vindas.mp4" poster="/avatar/boas-vindas-poster.webp" autoPlay playsInline preload="auto" onEnded={() => setGreeting(false)} onError={() => setGreeting(false)} className="h-full object-contain" style={{ aspectRatio: "9 / 16" }} aria-label={t("study.greeting.label")} />
            </div>
          ) : (
            <AvatarArt state={recording ? "listening" : state} level={level} mode={messages.length > 0 ? "bust" : "full"} className="h-full w-full" />
          )}
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted">{t(statusKey)}</p>
        <h1 className="sr-only">{t("study.title")}</h1>
      </header>

      <section className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4" aria-label={t("study.title")}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-muted">{t("study.empty")}</p>
            {!greeting && <Button type="button" variant="ghost" onClick={() => { stopSpeaking(); setGreeting(true); }}>{t("study.greeting.play")}</Button>}
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} from={m.role} className="flex flex-col">
            <MiniMarkdown text={m.text} className="text-[17px] leading-relaxed" />
            {m.response && <TeacherExtras r={m.response} onRef={openRef} onVisual={(v) => setPanel({ visual: v, durationMs: 0 })} onOption={(label, intent) => void send(label, intent)} />}
            {m.messageId && <FlagButton messageId={m.messageId} />}
          </Bubble>
        ))}
        <div ref={endRef} />
      </section>

      {planBlock && <div className="mb-2" role="alert"><Toast tone="warn">{t("limit.reached").replace("{plan}", planBlock.plan === "premium" ? "Premium" : planBlock.plan === "plus" ? "Plus" : "Grátis")} <Link className="underline" href="/planos">{t("limit.upgrade")}</Link></Toast></div>}
      {fair && <div className="mb-2"><Toast tone="warn">{t("fair.use")}</Toast></div>}
      {error && <div className="mb-2"><Toast>{error}</Toast></div>}

      <form
        className="sticky bottom-0 flex items-center gap-2 bg-bg py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
          setInput("");
        }}
      >
        <button type="button" onClick={() => void toggleMic()} aria-pressed={recording} aria-label={recording ? t("study.mic.stop") : t("study.mic.start")} className={`h-14 w-14 shrink-0 rounded-full text-2xl shadow-[var(--shadow)] ${recording ? "bg-danger-ink text-danger-bg" : "bg-primary text-primary-ink"}`}>
          {recording ? "■" : "🎤"}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("study.placeholder")} className="h-12 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-base text-ink" />
        <Button type="submit">{t("study.send")}</Button>
      </form>
      <div className="flex items-center justify-between pb-3 text-sm">
        {messages.length > 0 && <a href={`/fechamento?s=${sessionId.current}`} className="inline-flex min-h-11 items-center rounded-control border border-line px-3">{t("study.end")}</a>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} />{t("study.textonly")}</label>
        {state === "speaking" && <Button type="button" variant="ghost" onClick={stopSpeaking}>{t("study.interrupt")}</Button>}
      </div>

      {panel && <VisualPanel visual={panel.visual} durationMs={panel.durationMs} onClose={() => setPanel(null)} onOpenRef={(r) => void openRef(r)} />}

      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => (
            <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>
          ))}
          {verse.ref && <Button type="button" variant="ghost" onClick={() => void addBookmark(verse.ref!, MAIN_VERSION).then(() => setMarked(true)).catch(() => undefined)} className="mt-2">{marked ? t("bookmark.done") : t("bookmark.add")}</Button>}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)} className="mt-2">{t("study.verse.close")}</Button>
        </Modal>
      )}
      </div>
      {docMode && sessionReady && (
        <div className={`pt-2 ${tab === "chat" ? "hidden md:block" : ""}`}><DocPanel sessionId={sessionId.current} mode={mode as "lesson" | "sermon"} refreshKey={docKey} /></div>
      )}
    </main>
  );
}

function TeacherExtras({ r, onRef, onVisual, onOption }: { r: TeacherResponse; onRef(ref: string): void; onVisual(v: TeacherResponse["visuals"][number]): void; onOption(label: string, intent: string): void }) {
  const refs = new Set<string>();
  for (const c of r.citations) if (c.type === "bible") refs.add(c.ref);
  for (const f of findReferences(`${r.speech} ${r.display_markdown}`, { strictCase: true })) if (!f.invalid) f.refs.forEach((x) => refs.add(x));
  const works = r.citations.filter((c) => c.type === "work");
  return (
    <div className="mt-2 space-y-2">
      {r.lens_divergence.present && (
        <Toast tone="warn">
          <strong>{t("study.divergence")}</strong> {r.lens_divergence.summary}
          <Button type="button" variant="ghost" className="mt-1 text-sm" onClick={() => onOption(t("study.divergence.compare"), "other_traditions")}>{t("study.divergence.compare")}</Button>
        </Toast>
      )}
      {r.visuals.filter((v) => v.kind === "map" || v.kind === "timeline" || v.kind === "illustration" || v.kind === "model3d").length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.visuals.map((v, i) => (v.kind === "map" || v.kind === "timeline" || v.kind === "illustration" || v.kind === "model3d" ? <Button key={i} type="button" className="text-sm" onClick={() => onVisual(v)}>{t(v.kind === "map" ? "visual.open.map" : v.kind === "timeline" ? "visual.open.timeline" : v.kind === "model3d" ? "visual.open.model3d" : "visual.open.illustration")}</Button> : null))}
        </div>
      )}
      {refs.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...refs].slice(0, 6).map((ref) => (
            <Chip key={ref} onClick={() => onRef(ref)}>{formatRefPt(ref)}</Chip>
          ))}
        </div>
      )}
      {works.length > 0 && (
        <p className="text-xs text-muted">{t("study.sources")}: {works.map((w) => (w.type === "work" ? w.label : "")).join("; ")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {r.next_options.map((o) => (
          <Button key={o.label} type="button" onClick={() => onOption(o.label, o.intent)} className="text-sm">{o.label}</Button>
        ))}
      </div>
    </div>
  );
}

/** "Isso está errado?": the student reports an answer; it goes to the reviewers (answer_flags). */
function FlagButton({ messageId }: { messageId: string }) {
  const [step, setStep] = useState<"idle" | "form" | "sent">("idle");
  const [reason, setReason] = useState("");
  if (step === "sent") return <p className="mt-2 text-xs text-muted">{t("study.flag.thanks")}</p>;
  if (step === "idle") return <button type="button" className="mt-2 text-xs text-muted underline" onClick={() => setStep("form")}>{t("study.flag")}</button>;
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void flagAnswer(messageId, reason.trim() || undefined).finally(() => setStep("sent")); }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("study.flag.placeholder")} className="h-9 min-w-0 flex-1 rounded-control border border-line bg-surface px-2 text-sm text-ink" />
      <Button type="submit" className="text-sm">{t("study.flag.send")}</Button>
    </form>
  );
}
