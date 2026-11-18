import type { HTMLAttributes } from "react";

export function Bubble({ from, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { from: "user" | "teacher" }) {
  const side = from === "user" ? "self-end bg-accent text-accent-ink rounded-card rounded-br-md" : "self-start bg-surface rounded-card rounded-bl-md";
  return <div {...props} className={`max-w-[90%] px-4 py-3 shadow-[var(--shadow)] ${side} ${className}`} />;
}
