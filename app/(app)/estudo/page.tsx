"use client";

// Prototype study screen (Prompt 0.1, step 8): talk or type, hear the professor, read captions,
// tap reference chips and next-step buttons, interrupt at any time.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AvatarState } from "@/components/teacher/Avatar";
import { Bubble } from "@/components/ui/Bubble";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { createSession, getBibleVerses, speakSentence, teacherTurn, transcribeAudio } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { findReferences, formatRefPt } from "@/lib/knowledge/refs-parser";
import { getPlatform } from "@/lib/platform";
import { loadPrefs } from "@/lib/prefs";
import type { TeacherResponse } from "@/lib/teacher/schema";
import { splitSentences } from "@/lib/voice/speech-text";

const Avatar3D = dynamic(() => import("@/components/teacher/Avatar3D").then((m) => m.Avatar3D), { ssr: false, loading: () => <div className="h-full w-full" aria-hidden /> });

const CUE_STATE = { neutral: "idle", happy: "happy", surprised: "happy", thoughtful: "thinking", empathetic: "empathetic", pointing: "pointing" } as const satisfies Record<string, AvatarState>;

type Msg = { id: number; role: "user" | "teacher"; text: string; response?: TeacherResponse };

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
  const [verse, setVerse] = useState<{ title: string; lines: { ref: string; text: string }[] } | null>(null);
  const sessionId = useRef("");
  const nextId = useRef(1);
  const playId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // The conversation lives in a server-side session: /estudo?s=<id> (query string keeps the screen exportable for Capacitor).
  useEffect(() => {
    const existing = new URLSearchParams(window.location.search).get("s");
    if (existing) {
      sessionId.current = existing;
      return;
    }
    void createSession("free")
      .then(({ sessionId: id }) => {
        sessionId.current = id;
        router.replace(`/estudo?s=${id}`);
      })
      .catch(() => router.replace("/login"));
  }, [router]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => getPlatform().audioPlayer.onLevel(setLevel), []);

  const stopSpeaking = useCallback(() => {
    playId.current++;
    getPlatform().audioPlayer.stop();
    getPlatform().speech.cancel();
    setLevel(0);
    setState("idle");
  }, []);

  const speak = useCallback(async (speech: string, cue?: AvatarState) => {
    const my = ++playId.current;
    const sentences = splitSentences(speech);
    const platform = getPlatform();
    setState("speaking");
    try {
      if (platform.speech.isSupported()) {
        // Free on-device voice (D-04 prototype): sentence by sentence, mouth driven by the speech level.
        for (const sentence of sentences) {
          if (my !== playId.current) return;
          await platform.speech.speak(sentence, { voiceName: (await loadPrefs()).voiceName, onLevel: (lv) => my === playId.current && setLevel(lv) });
        }
      } else {
        let next = speakSentence(sentences[0]);
        for (let i = 0; i < sentences.length; i++) {
          const blob = await next;
          if (my !== playId.current) return;
          if (i + 1 < sentences.length) next = speakSentence(sentences[i + 1]);
          await platform.audioPlayer.play(blob);
          if (my !== playId.current) return;
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
        const { response } = await teacherTurn({ sessionId: sessionId.current, text: clean, intent });
        setMessages((m) => [...m, { id: nextId.current++, role: "teacher", text: response.display_markdown || response.speech, response }]);
        if (response.pastoral_flag) setState("empathetic");
        const cue: AvatarState = response.pastoral_flag ? "empathetic" : response.avatar_cue && response.avatar_cue !== "neutral" ? CUE_STATE[response.avatar_cue] : response.visuals.length ? "pointing" : "idle";
        if (!textOnly) await speak(response.speech, cue);
        else setState(cue);
      } catch (e) {
        setState("idle");
        const msg = (e as Error).message;
        if (msg === "api_error_401") return router.replace("/login");
        setError(msg === "api_error_503" ? t("study.error.unavailable") : t("study.error.turn"));
      }
    },
    [speak, stopSpeaking, textOnly, router],
  );

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
    try {
      const r = await getBibleVerses(MAIN_VERSION, ref);
      setVerse({ title: formatRefPt(ref), lines: r.verses });
    } catch {
      setVerse({ title: formatRefPt(ref), lines: [{ ref, text: "—" }] });
    }
  }, []);

  const statusKey = recording ? "study.status.listening" : state === "thinking" ? "study.status.thinking" : state === "speaking" ? "study.status.speaking" : "study.status.idle";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex flex-col items-center gap-1 py-2">
        <div className="h-[46dvh] max-h-[460px] min-h-[260px] w-full max-w-sm">
          <Avatar3D state={recording ? "listening" : state} level={level} mode={messages.length > 0 ? "bust" : "full"} className="h-full w-full" />
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted">{t(statusKey)}</p>
        <h1 className="sr-only">{t("study.title")}</h1>
      </header>

      <section className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4" aria-label={t("study.title")}>
        {messages.length === 0 && <p className="py-8 text-center text-muted">{t("study.empty")}</p>}
        {messages.map((m) => (
          <Bubble key={m.id} from={m.role} className="flex flex-col">
            <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{m.text}</p>
            {m.response && <TeacherExtras r={m.response} onRef={openRef} onOption={(label, intent) => void send(label, intent)} />}
          </Bubble>
        ))}
        <div ref={endRef} />
      </section>

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
        {messages.length > 0 && <a href={`/feedback?s=${sessionId.current}`} className="inline-flex min-h-11 items-center rounded-control border border-line px-3">{t("study.end")}</a>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} />{t("study.textonly")}</label>
        {state === "speaking" && <Button type="button" variant="ghost" onClick={stopSpeaking}>{t("study.interrupt")}</Button>}
      </div>

      {verse && (
        <Modal title={verse.title} onClose={() => setVerse(null)}>
          {verse.lines.map((l) => (
            <p key={l.ref} className="mb-2 text-[17px]"><sup className="mr-1 text-muted">{l.ref.split(".").pop()}</sup>{l.text}</p>
          ))}
          <Button type="button" variant="ghost" onClick={() => setVerse(null)} className="mt-2">{t("study.verse.close")}</Button>
        </Modal>
      )}
    </main>
  );
}

function TeacherExtras({ r, onRef, onOption }: { r: TeacherResponse; onRef(ref: string): void; onOption(label: string, intent: string): void }) {
  const refs = new Set<string>();
  for (const c of r.citations) if (c.type === "bible") refs.add(c.ref);
  for (const f of findReferences(`${r.speech} ${r.display_markdown}`, { strictCase: true })) if (!f.invalid) f.refs.forEach((x) => refs.add(x));
  const works = r.citations.filter((c) => c.type === "work");
  return (
    <div className="mt-2 space-y-2">
      {r.lens_divergence.present && <Toast tone="warn">Aqui as tradições divergem. {r.lens_divergence.summary}</Toast>}
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
