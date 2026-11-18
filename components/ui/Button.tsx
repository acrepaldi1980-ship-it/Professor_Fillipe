import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink",
  accent: "bg-accent text-accent-ink",
  ghost: "border border-line bg-transparent text-ink",
  danger: "bg-danger-bg text-danger-ink",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`min-h-11 rounded-control px-4 font-semibold transition-opacity disabled:opacity-50 ${styles[variant]} ${className}`} />;
}
