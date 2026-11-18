"use client";

import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setState("sending");
    try {
      const ref = new URLSearchParams(window.location.search).get("s") ?? undefined;
      await apiJson("/feedback", { method: "POST", body: JSON.stringify({ rating, comment: comment || undefined, sessionRef: ref }) });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done")
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">{t("feedback.thanks")}</h1>
        <a href="/estudo" className="rounded-xl bg-[#2f4a6b] px-4 py-3 text-white">{t("feedback.back")}</a>
      </main>
    );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">{t("feedback.title")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={t("feedback.rating")} className="flex justify-between">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)} className={`h-14 w-14 rounded-full border text-xl ${rating === n ? "bg-[#2f4a6b] text-white" : ""}`}>{n}</button>
          ))}
        </div>
        <p className="flex justify-between text-sm opacity-70"><span>{t("feedback.low")}</span><span>{t("feedback.high")}</span></p>
        <label className="flex flex-col gap-1">
          <span>{t("feedback.comment")}</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={2000} className="rounded-xl border border-black/20 bg-transparent p-3 text-base" />
        </label>
        {state === "error" && <p role="alert" className="text-red-700">{t("feedback.error")}</p>}
        <button type="submit" disabled={!rating || state === "sending"} className="h-12 rounded-xl bg-[#2f4a6b] text-white disabled:opacity-50">{t("feedback.send")}</button>
      </form>
    </main>
  );
}
