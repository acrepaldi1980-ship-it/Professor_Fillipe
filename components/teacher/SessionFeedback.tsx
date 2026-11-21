"use client";

// "Como foi essa aula?" at the end of a session (RF-M09). Stores only the rating, an optional comment and the session id.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiJson } from "@/lib/api-client";
import { t } from "@/lib/i18n";

export function SessionFeedback({ sessionId }: { sessionId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send() {
    if (!rating) return;
    setState("sending");
    try {
      await apiJson("/feedback", { method: "POST", body: JSON.stringify({ rating, comment: comment || undefined, sessionRef: sessionId }) });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <Card><p role="status">{t("feedback.thanks")}</p></Card>;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg">{t("feedback.session.title")}</h2>
      <div role="radiogroup" aria-label={t("feedback.rating")} className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)} className={`min-h-11 min-w-11 rounded-control border text-lg ${rating === n ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{n}</button>
        ))}
      </div>
      <p className="flex justify-between text-xs text-muted"><span>{t("feedback.low")}</span><span>{t("feedback.high")}</span></p>
      {rating > 0 && <textarea aria-label={t("feedback.comment")} placeholder={t("feedback.comment")} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} className="min-h-20 rounded-control border border-line bg-surface p-2" />}
      {state === "error" && <p role="alert" className="text-sm text-muted">{t("feedback.error")}</p>}
      <div><Button type="button" disabled={!rating || state === "sending"} onClick={() => void send()}>{t("feedback.send")}</Button></div>
    </Card>
  );
}
