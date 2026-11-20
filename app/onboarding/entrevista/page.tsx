"use client";

// Guided interview (J01, RF-M03-01): the teacher asks 7 questions by voice, with text and quick-reply buttons, and reacts to each answer.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarArt } from "@/components/teacher/AvatarArt";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { getMe, submitInterview, type InterviewAnswers } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { reaction, TOTAL_STEPS, visibleSteps, type Step } from "@/lib/onboarding/script";
import { getPlatform } from "@/lib/platform";
import { loadPrefs } from "@/lib/prefs";

type Answers = Record<string, string | number | string[]>;

export default function InterviewPage() {
  const router = useRouter();
  const [religious, setReligious] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [react, setReact] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const spoken = useRef("");

  useEffect(() => {
    void getMe().then((m) => {
      setReligious(!!m.consents.sensitive_religious?.granted);
      if (m.profile?.preferred_name && !m.onboarding.needsInterview) router.replace("/inicio");
    });
  }, [router]);

  const steps = religious === null ? [] : visibleSteps({ religiousConsent: religious, ministry: (answers.ministry_role as never) ?? null });
  const step: Step | undefined = steps[index];

  const say = useCallback(async (line: string) => {
    if (spoken.current === line) return;
    spoken.current = line;
    try {
      const prefs = await loadPrefs();
      await getPlatform().speech.speak(line, { voiceName: prefs.voiceName ?? undefined });
    } catch {
      /* silent: the text is on screen */
    }
  }, []);

  useEffect(() => {
    if (step) void say(step.question);
  }, [step, say]);

  async function finish(final: Answers) {
    setBusy(true);
    setError(false);
    try {
      const payload: InterviewAnswers = {
        preferred_name: String(final.preferred_name),
        study_experience: final.study_experience as InterviewAnswers["study_experience"],
        goals: (final.goals as string[]) ?? [],
        ministry_role: final.ministry_role as string | undefined,
        teaching_age_group: final.teaching_age_group as string | undefined,
        daily_minutes: Number(final.daily_minutes),
        preferred_formats: (final.preferred_formats as string[]) ?? [],
        first_topic: String(final.first_topic),
      };
      await submitInterview(payload);
      router.replace("/onboarding/configuracao");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  async function answer(value: string | number | string[]) {
    if (!step) return;
    const next = { ...answers, [step.field]: value };
    setAnswers(next);
    const line = reaction(step.id, value, step.id === "name" ? "" : String(next.preferred_name ?? ""));
    setReact(line);
    setText("");
    setPicked([]);
    const remaining = visibleSteps({ religiousConsent: !!religious, ministry: (next.ministry_role as never) ?? null });
    const upcoming = remaining[index + 1];
    // short pause so the reaction can be read, then the next question (or the end)
    window.setTimeout(() => {
      setReact(null);
      if (!upcoming) void finish(next);
      else setIndex((i) => i + 1);
    }, 1400);
    void say(line);
  }

  if (religious === null || !step) return <p role="status" className="grid min-h-dvh place-items-center text-muted">{t("common.loading")}</p>;
  const shown = Math.min(step.n, TOTAL_STEPS);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mt-2" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={shown} aria-label={t("interview.progress").replace("{n}", String(shown)).replace("{total}", String(TOTAL_STEPS))}>
        <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${(shown / TOTAL_STEPS) * 100}%` }} /></div>
        <p className="mt-1 text-center text-sm text-muted">{t("interview.progress").replace("{n}", String(shown)).replace("{total}", String(TOTAL_STEPS))}</p>
      </div>
      <div className="h-[34dvh] min-h-[220px] w-full"><AvatarArt state={busy ? "thinking" : react ? "happy" : "idle"} mode="full" className="h-full w-full" /></div>
      <p className="rounded-control bg-surface p-3 text-lg" aria-live="polite">{react ?? step.question}</p>
      {error && <Toast>{t("interview.error")}</Toast>}
      {!react && !busy && (
        <div className="flex flex-col gap-2">
          {step.kind === "text" && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= (step.id === "topic" ? 2 : 1)) void answer(text.trim()); }}>
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={step.id === "name" ? 40 : 200} aria-label={step.question} placeholder={t(step.id === "name" ? "interview.name.placeholder" : "interview.topic.placeholder")} className="h-12 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-base text-ink" />
              <Button type="submit" disabled={!text.trim()}>{t("interview.next")}</Button>
            </form>
          )}
          {step.kind === "single" && step.options!.map((o) => <Button key={String(o.value)} type="button" onClick={() => void answer(o.value)}>{o.label}</Button>)}
          {step.kind === "multi" && (
            <>
              <div className="flex flex-wrap gap-2">
                {step.options!.map((o) => {
                  const on = picked.includes(String(o.value));
                  return (
                    <button key={String(o.value)} type="button" aria-pressed={on} className={`min-h-11 rounded-control border px-3 ${on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface"}`} onClick={() => setPicked(on ? picked.filter((x) => x !== o.value) : [...picked, String(o.value)])}>{o.label}</button>
                  );
                })}
              </div>
              <Button type="button" disabled={picked.length === 0} onClick={() => void answer(picked)}>{t("interview.next")}</Button>
            </>
          )}
          <p className="text-center text-xs text-muted">{t("interview.typehint")}</p>
        </div>
      )}
    </main>
  );
}
