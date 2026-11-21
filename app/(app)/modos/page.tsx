"use client";

// Setup of a guided mode (spec 8.7): lesson (topic, text, age group, minutes, magazine), sermon (type, text or theme)
// or Aprofundar (passage). Creates the session with its context and opens the conversation.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/teacher/Avatar";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import Link from "next/link";
import { createSession, getMe, getSermonTypes, isPlanBlock } from "@/lib/api-client";
import { t } from "@/lib/i18n";

const AGES = ["kids", "teens", "youth", "adults", "mixed"] as const;
const MINUTES = [30, 45, 60, 90] as const;
const input = "h-12 rounded-control border border-line bg-surface px-3 text-base text-ink";

export default function ModeSetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"lesson" | "sermon" | "deep">("lesson");
  const [topic, setTopic] = useState("");
  const [ref, setRef] = useState("");
  const [age, setAge] = useState<(typeof AGES)[number]>("adults");
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>(45);
  const [magazine, setMagazine] = useState("");
  const [types, setTypes] = useState<{ name: string; definition: string }[]>([]);
  const [type, setType] = useState("Expositivo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [block, setBlock] = useState<{ error: string; needs?: string; plan?: string } | null>(null);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (m === "lesson" || m === "sermon" || m === "deep") setMode(m);
    void getSermonTypes().then((r) => setTypes(r.types)).catch(() => undefined);
    void getMe().then((me) => { const g = (me.profile as { teaching_age_group?: string } | null)?.teaching_age_group; if (g && (AGES as readonly string[]).includes(g)) setAge(g as (typeof AGES)[number]); }).catch(() => undefined);
  }, []);

  async function start() {
    setBusy(true);
    setError(false);
    try {
      const context = mode === "lesson" ? { topic, ref: ref || undefined, age_group: age, minutes, magazine: magazine || undefined } : mode === "sermon" ? { sermon_type: type, ref_or_theme: ref } : { ref };
      const { sessionId } = await createSession(mode, context);
      router.replace(`/estudo?s=${sessionId}`);
    } catch (e) {
      if (isPlanBlock(e)) setBlock(e.data as { error: string; needs?: string; plan?: string });
      else setError(true);
      setBusy(false);
    }
  }
  const valid = mode === "lesson" ? topic.trim().length >= 2 : ref.trim().length >= 2;
  const def = types.find((x) => x.name === type)?.definition;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-4 pb-24">
      <div className="flex items-center gap-3 pt-2"><Avatar state="happy" size={56} /><h1 className="text-2xl">{t(`modes.${mode}`)}</h1></div>
      <p className="text-sm text-muted">{t(`modes.${mode}.help`)}</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (valid) void start(); }}>
        {mode === "lesson" && (
          <>
            <label className="flex flex-col gap-1"><span className="text-sm">{t("lesson.topic")}</span><input className={input} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} /></label>
            <label className="flex flex-col gap-1"><span className="text-sm">{t("lesson.ref")}</span><input className={input} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} /></label>
            <label className="flex flex-col gap-1"><span className="text-sm">{t("lesson.age")}</span>
              <select className={input} value={age} onChange={(e) => setAge(e.target.value as (typeof AGES)[number])}>{AGES.map((a) => <option key={a} value={a}>{t(`age.${a}`)}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-sm">{t("lesson.minutes")}</span>
              <select className={input} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) as (typeof MINUTES)[number])}>{MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-sm">{t("lesson.magazine")}</span><input className={input} value={magazine} onChange={(e) => setMagazine(e.target.value)} maxLength={120} /></label>
          </>
        )}
        {mode === "sermon" && (
          <>
            <label className="flex flex-col gap-1"><span className="text-sm">{t("sermon.type")}</span>
              <select className={input} value={type} onChange={(e) => setType(e.target.value)}>{(types.length ? types : [{ name: "Expositivo", definition: "" }]).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
            {def && <p className="text-sm text-muted">{def}</p>}
            <label className="flex flex-col gap-1"><span className="text-sm">{t("sermon.ref")}</span><input className={input} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={200} /></label>
          </>
        )}
        {mode === "deep" && <label className="flex flex-col gap-1"><span className="text-sm">{t("deep.ref")}</span><input className={input} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} /></label>}
        {block && <Toast tone="warn">{block.error === "plan_required" ? t("plan.required").replace("{needs}", block.needs === "premium" ? "Premium" : "Plus") : t("limit.reached").replace("{plan}", block.plan === "plus" ? "Plus" : "Grátis")} <Link className="underline" href="/planos">{t("limit.upgrade")}</Link></Toast>}
        {error && <Toast>{t("consent.error")}</Toast>}
        <Button type="submit" disabled={!valid || busy}>{t("modes.start")}</Button>
      </form>
    </main>
  );
}
