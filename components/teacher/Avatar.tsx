"use client";

// Professor Filipe: compact round avatar (the round portrait of the final art, D-18) for headers, icons and small spots.
// Decorative for screen readers (aria-hidden): the current state is announced as text by the screen.
export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "empathetic" | "pointing" | "insight";

export function Avatar({ state, level = 0, size = 112, animated = true }: { state: AvatarState; level?: number; size?: number; animated?: boolean }) {
  const bob = animated && state === "speaking" ? Math.min(1, level * 3.2) * Math.max(1, size * 0.03) : 0;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/avatar/retrato.webp" alt="" aria-hidden="true" draggable={false} width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, transform: `translateY(${-bob}px)`, transition: "transform 90ms linear" }} />
  );
}
