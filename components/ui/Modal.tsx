"use client";

import { useEffect, type ReactNode } from "react";

/** Bottom sheet on phones, centered card on larger screens. Closes with Esc. */
export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow)] sm:rounded-card">
        <h2 className="mb-3 text-xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}
