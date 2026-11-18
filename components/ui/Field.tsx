import type { InputHTMLAttributes } from "react";

export function Field({ label, id, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <input id={id} {...props} className={`min-h-12 rounded-control border border-line bg-surface px-3 text-base text-ink ${className}`} />
    </label>
  );
}
