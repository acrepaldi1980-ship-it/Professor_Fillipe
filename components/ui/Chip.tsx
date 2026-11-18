import type { ButtonHTMLAttributes } from "react";

/** Reference chip ("João 3:16"): opens the verse. At least 44px tall for touch. */
export function Chip({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`min-h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold text-link ${className}`} />;
}
