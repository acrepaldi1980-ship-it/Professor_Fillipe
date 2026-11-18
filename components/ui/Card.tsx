import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-card bg-surface p-4 shadow-[var(--shadow)] ${className}`} />;
}
