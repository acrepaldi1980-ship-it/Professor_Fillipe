"use client";

// Prototype study screen (Prompt 0.1, step 8): talk or type, hear the professor, read captions,
// tap reference chips and next-step buttons, interrupt at any time.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarState } from "@/components/teacher/Avatar";
import { AvatarArt } from "@/components/teacher/AvatarArt";
import { DeepPanel } from "@/components/modes/DeepPanel";
import { DocPanel } from "@/components/modes/DocPanel";
import { ShareCardButton } from "@/components/share/ShareCardButton";
import { SermonPanel } from "@/components/modes/SermonPanel";
import { VisualPanel } from "@/components/visuals/VisualPanel";
import { Bubble } from "@/components/ui/Bubble";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { MiniMarkdown } from "@/components/ui/MiniMarkdown";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackEvent, isPlanBlock, addBookmark, closeSessionFull, completePathDay, createSession, getJosephusChapter, getPathDetail, flagAnswer, getBibleVerses, getMe, getSessionDocument, answerVoice, warmVoice, teacherTurn, transcribeAudio } from "@/lib/api-client";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { findReferences, formatRefPt } from "@/lib/knowledge/refs-parser";
import { getPlatform } from "@/lib/platform";
import { loadPrefs } from "@/lib/prefs";
import type { TeacherResponse } from "@/lib/teacher/schema";
import { byId } from "@/lib/historians/data";
import { shortFirstChunk, splitSentences } from "@/lib/voice/speech-text";
import { speakQueue } from "@/lib/voice/speak-queue";

const CUE_STATE = { neutral: "idle", happy: "happy", surprised: "insight", thoughtful: "thinking", empathetic: "empathetic", pointing: "pointing" } as const satisfies Record<string, AvatarState>;

type Msg = { id: number; role: "user" | "teacher"; text: string; response?: TeacherResponse; messageId?: string; /** the text is still being written (provisional until the answer is checked) */ streaming?: boolean };

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
  const trailRef = useRef<{ pathId: string; day: number } | null>(null); // a day of a guided path (?trilha=&dia=)
  const [trailBanner, setTrailBanner] = useState<{ pathId: string; day: number } | null>(null);
  const [trailDone, setTrailDone] = useState(false);
  const josRef = useRef<{ work: "ant" | "war" | "life" | "apion"; book: number; chapter: number } | null>(null); // studying Josephus (?jos=work.book.chapter)
  const [josBanner, setJosBanner] = useState<string | null>(null);
  const histRef = useRef<{ id: string; passage?: string; unit?: { work: string; ord: number } } | null>(null); // studying a historian (?hist=id or ?hist=id.passage)
  const [histBanner, setHistBanner] = useState<string | null>(null);
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
    const tp = query.get("trilha"), td = Number(query.get("dia"));
    if (tp && td > 0) { trailRef.current = { pathId: tp, day: td }; setTrailBanner({ pathId: tp, day: td }); firstLesson.current = true; }
    const jp = /^(ant|war|life|apion)\.(\d+)\.(\d+)$/.exec(query.get("jos") ?? "");
    if (jp) { josRef.current = { work: jp[1] as "ant" | "war" | "life" | "apion", book: Number(jp[2]), chapter: Number(jp[3]) }; setJosBanner(query.get("jos")); firstLesson.current = true; }
    const hu = /^([a-z]{3,12})\.([a-z]{2,12})\.(\d{1,4})$/.exec(query.get("hu") ?? ""); // reading a unit of a historian's book (?hu=author.work.ord)
    if (hu) { histRef.current = { id: hu[1], unit: { work: hu[2], ord: Number(hu[3]) } }; setHistBanner(`${byId(hu[1])?.name ?? hu[1]} (${hu[2]} ${hu[3]})`); firstLesson.current = true; }
    const hp = /^([a-z]{3,12})(?:\.([a-z0-9]{3,12}))?$/.exec(query.get("hist") ?? "");
    if (hp && !hu) { histRef.current = { id: hp[1], passage: hp[2] }; const h = byId(hp[1]); setHistBanner(hp[1] === "testemunhos" ? t("hist.testimonies") : h ? `${h.name}${hp[2] ? `: ${h.passages.find((x) => x.id === hp[2])?.cite ?? ""}` : ""}` : null); firstLesson.current = true; }
    const lessonId = query.get("lesson"); // a lesson published by the church (home card)
    if (lessonId) { firstLesson.current = true; themeRef.current = query.get("titulo") ?? t("study.church.default"); }
    const existing = query.get("s");
    if (existing) {
      sessionId.current = existing;
      setSessionReady(true);
      return;
    }
    void createSession("free", undefined, lessonId ?? undefined, trailRef.current ? { pathId: trailRef.current.pathId, pathDay: trailRef.current.day } : undefined)
      .then(({ sessionId: id }) => {
        sessionId.current = id;
        router.replace(`/estudo?s=${id}${trailRef.current ? `&trilha=${trailRef.current.pathId}&dia=${trailRef.current.day}` : ""}${josRef.current ? `&jos=${josRef.current.work}.${josRef.current.book}.${josRef.current.chapter}` : ""}${histRef.current ? `&${histRef.current.unit ? `hu=${histRef.current.id}.${histRef.current.unit.work}.${histRef.current.unit.ord}` : `hist=${histRef.current.id}${histRef.current.passage ? `.${histRef.current.passage}` : ""}`}` : ""}`);
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
  useEffect(() => { warmVoice(); }, []); // the voice wakes up while the student reads

  const stopSpeaking = useCallback(() => {
    playId.current++;
    getPlatform().audioPlayer.stop();
    getPlatform().speech.cancel();
    setLevel(0);
    setState("idle");
  }, []);

  // Server voice (Gemini, the same family as the greeting video) first; if it is unavailable the device voice takes over for the rest.
  const serverVoice = useRef<"unknown" | "ok" | "down">("unknown");
  const speak = useCallback(async (speech: string, cue?: AvatarState, onFirstSound?: () => void) => {
    const my = ++playId.current;
    const sentences = shortFirstChunk(splitSentences(speech));
    const platform = getPlatform();
    let first = false;
    const firstSound = () => { if (first) return; first = true; onFirstSound?.(); };
    try {
      let from = 0;
      const deviceOnly = (await loadPrefs()).voiceSource === "device" && platform.speech.isSupported(); // one voice for everything: the device voice only when the student chose it
      if (serverVoice.current !== "down" && !deviceOnly) {
        // all the sentences are requested at once (3 in flight) and queued back to back on the audio clock: no gaps, and the mouth follows the audible sound
        const r = await speakQueue(sentences, {
          fetchAudio: answerVoice(),
          player: platform.audioPlayer,
          isCurrent: () => my === playId.current,
          onFirstSound: () => { if (my === playId.current) { setState("speaking"); firstSound(); } },
        });
        if (r.played) serverVoice.current = "ok";
        if (r.failedAt !== null) { serverVoice.current = "down"; from = r.failedAt; } else from = sentences.length;
      }
      // the device voice takes over for what the server voice could not speak
      for (let i = from; i < sentences.length && my === playId.current; i++) {
        if (platform.speech.isSupported()) {
          setState("speaking");
          firstSound();
          const voiceName = (await loadPrefs()).voiceName;
          let missing = false;
          await platform.speech.speak(sentences[i], { voiceName, onLevel: (lv) => my === playId.current && setLevel(lv), onUnavailable: () => { missing = true; } });
          if (missing) { setError(t("study.error.malevoice")); break; }
        } else setError(t("study.error.voice"));
      }
    } catch {
      if (my === playId.current) setError(t("study.error.voice"));
    }
    firstSound(); // never leave the text hidden
    if (my === playId.current) {
      setLevel(0);
      setState(cue ?? "idle");
    }
  }, []);

  const send = useCallback(
    async (text: string, intent?: string) => {
      const clean = text.trim();
      if (!clean) return;
      // the session is created in the background when the screen opens: a very fast first message waits for it instead of failing with "invalid request"
      for (let i = 0; i < 50 && !sessionId.current; i++) await new Promise((r) => setTimeout(r, 200));
      getPlatform().speech.unlock();
      stopSpeaking();
      setError(null);
      setMessages((m) => [...m, { id: nextId.current++, role: "user", text: clean }]);
      setState("thinking");
      warmVoice(); // the voice loads while the teacher thinks
      try {
        const tid = nextId.current++;
        // the answer arrives first; the message id (for the "wrong?" button) and the fair-use flag arrive when the server has saved it
        const { response, meta } = await teacherTurn({ sessionId: sessionId.current, text: clean, intent, josephus: josRef.current ?? undefined, historian: histRef.current ?? undefined }, undefined, (d) => {
          setFair(!!(d as { fairUse?: boolean }).fairUse);
          if (d.messageId) setMessages((m) => m.map((x) => (x.id === tid ? { ...x, messageId: d.messageId } : x)));
        }, (partial) => {
          // streaming: the text appears while the model writes it (provisional); an empty text means the attempt failed and another model starts over
          setMessages((m) => {
            if (!partial) return m.filter((x) => !(x.id === tid && x.streaming));
            return m.some((x) => x.id === tid) ? m.map((x) => (x.id === tid && x.streaming ? { ...x, text: partial } : x)) : [...m, { id: tid, role: "teacher", text: partial, streaming: true }];
          });
        });
        setFair(!!(meta as { fairUse?: boolean }).fairUse);
        let shown = false;
        // The text, the visual and the voice appear TOGETHER: the text is held until the first sound is audible (at most 2 s, so a slow voice never hides the answer).
        const reveal = () => {
          if (shown) return;
          shown = true;
          (globalThis as { __pfSync?: unknown[] }).__pfSync?.push({ mark: "reveal", t: performance.now() }); // test hook
          // the checked answer takes the place of the provisional text (or is added, when nothing was streamed)
          setMessages((m) => { const final: Msg = { id: tid, role: "teacher", text: response.display_markdown || response.speech, response, messageId: meta.messageId }; return m.some((x) => x.id === tid) ? m.map((x) => (x.id === tid ? final : x)) : [...m, final]; });
          // The teacher opened a visual (RF-M08-01): the panel appears while the speech plays, and the map animates for its length.
        if (response.visuals.length) setPanel({ visual: response.visuals[0], durationMs: Math.round((response.speech.split(/\s+/).length / 2.6) * 1000) });
        };
        if (response.pastoral_flag) setState("empathetic");
        const cue: AvatarState = response.pastoral_flag ? "empathetic" : response.avatar_cue && response.avatar_cue !== "neutral" ? CUE_STATE[response.avatar_cue] : response.visuals.length ? "pointing" : "idle";
        if (!textOnly) {
          const hold = window.setTimeout(reveal, 2000);
          await speak(response.speech, cue, () => { window.clearTimeout(hold); reveal(); });
          window.clearTimeout(hold);
          reveal();
        } else { reveal(); setState(cue); }
      } catch (e) {
        setState("idle");
        setMessages((m) => m.filter((x) => !x.streaming)); // a half-written provisional text is not kept
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
    if (trailRef.current) {
      const tr = trailRef.current;
      return void getPathDetail(tr.pathId).then((d) => { const day = d.days.find((x) => x.day === tr.day); void send(t("study.trail.ask").replace("{n}", String(tr.day)).replace("{title}", day?.title ?? d.title)); }).catch(() => void send(t("study.trail.ask").replace("{n}", String(tr.day)).replace("{title}", "")));
    }
    if (histRef.current) {
      const hr = histRef.current, h = byId(hr.id), p = h?.passages.find((x) => x.id === hr.passage);
      return void send(hr.unit ? t("hist.seed.unit").replace("{name}", h?.name ?? hr.id) : hr.id === "testemunhos" ? t("hist.seed.testimonies") : p ? t("hist.seed.passage").replace("{name}", h!.name).replace("{cite}", p.cite).replace("{topic}", p.topic) : t("hist.seed.author").replace("{name}", h?.name ?? hr.id));
    }
    if (josRef.current) {
      const j = josRef.current;
      return void getJosephusChapter(j.work, j.book, j.chapter).then((c) => void send(t("jos.seed").replace("{cite}", `${j.work === "life" ? "Vida" : j.work === "apion" ? `Contra Apião ${j.book}` : `${j.work === "ant" ? "Antiguidades" : "Guerra"} ${j.book}.${j.chapter}`}`).replace("{title}", c.title || c.info?.title || ""))).catch(() => undefined);
    }
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
        const r = await getBibleVerses(defaultBibleVersion(), ref);
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

  const docMode = mode === "lesson" || mode === "sermon" || mode === "deep";
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
      {histBanner && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-primary bg-surface p-2 text-sm" data-testid="hist-banner">
          <span>{t("hist.banner").replace("{who}", histBanner)}</span>
          <a className="underline" href="/historiadores">{t("hist.back")}</a>
        </div>
      )}
      {josBanner && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-primary bg-surface p-2 text-sm" data-testid="jos-banner">
          <span>{t("jos.banner").replace("{cite}", josBanner)}</span>
          <a className="underline" href={`/josefo?w=${josBanner.split(".")[0]}&b=${josBanner.split(".")[1]}&c=${josBanner.split(".")[2]}`}>{t("jos.read")}</a>
        </div>
      )}
      {trailBanner && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-primary bg-surface p-2 text-sm" data-testid="trail-banner">
          <span>{t("study.trail.banner").replace("{n}", String(trailBanner.day))}</span>
          {trailDone ? <span role="status" className="font-semibold">{t("study.trail.done")}</span> : <Button type="button" className="text-sm" onClick={() => void completePathDay(trailBanner.pathId, trailBanner.day).then(() => setTrailDone(true)).catch(() => undefined)}>{t("study.trail.complete")}</Button>}
        </div>
      )}
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
          <Bubble key={m.id} from={m.role} className={`flex flex-col ${m.streaming ? "opacity-90" : ""}`} aria-busy={m.streaming || undefined}>
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
        <Button type="submit" disabled={!sessionReady}>{t("study.send")}</Button>
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
          <ShareCardButton text={verse.lines.map((l) => l.text).join(" ")} title={verse.title} credit={t("share.card.credit")} className="mt-2" />
          {verse.ref && <Button type="button" variant="ghost" onClick={() => void addBookmark(verse.ref!, defaultBibleVersion()).then(() => setMarked(true)).catch(() => undefined)} className="mt-2">{marked ? t("bookmark.done") : t("bookmark.add")}</Button>}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)} className="mt-2">{t("study.verse.close")}</Button>
        </Modal>
      )}
      </div>
      {docMode && sessionReady && (
        <div className={`pt-2 ${tab === "chat" ? "hidden md:block" : ""}`}>{mode === "deep" ? <DeepPanel sessionId={sessionId.current} refreshKey={docKey} onOpenRef={(r) => void openRef(r)} /> : mode === "sermon" ? <SermonPanel sessionId={sessionId.current} refreshKey={docKey} /> : <DocPanel sessionId={sessionId.current} mode="lesson" refreshKey={docKey} />}</div>
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
      {r.external_sources && r.external_sources.length > 0 && (
        <div role="note" data-testid="external-sources" className="rounded-control border border-line bg-surface p-2 text-xs">
          <strong>{t("study.external")}</strong> {t("study.external.help")}
          <ul className="mt-1 list-disc pl-4">
            {r.external_sources.map((x) => (
              <li key={x.url}><a className="underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.site}: {x.title}</a> <span className="text-muted">({x.license})</span></li>
            ))}
          </ul>
        </div>
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
