import type { ReactNode } from "react";

type Tone = "error" | "warn" | "ok";
const tones: Record<Tone, string> = { error: "bg-danger-bg text-danger-ink", warn: "bg-warn-bg text-warn-ink", ok: "bg-ok-bg text-ok-ink" };

export function Toast({ tone = "error", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-control px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}
