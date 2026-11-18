"use client";

// Provisional avatar (the real character comes in Prompt 1.6b). States per spec RF-M17-01;
// the mouth follows the audio level (RF-M17-02). Decorative for screen readers (aria-hidden); the state is announced as text.
export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "empathetic" | "pointing";

export function Avatar({ state, level = 0, size = 112 }: { state: AvatarState; level?: number; size?: number }) {
  const mouth = state === "speaking" ? 2 + Math.min(level * 26, 10) : state === "happy" ? 5 : 1.5;
  const eyeY = state === "thinking" ? 44 : 48;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" className="transition-transform duration-300 motion-reduce:transition-none" style={{ transform: state === "listening" ? "rotate(-4deg)" : "none" }}>
      <circle cx="50" cy="50" r="46" fill="#2f4a6b" />
      <circle cx="50" cy="52" r="34" fill="#f3d7b8" />
      <path d="M18 44c2-22 18-30 32-30s30 8 32 30c-6-10-16-15-32-15S24 34 18 44z" fill="#4a3a2c" />
      <circle cx="38" cy={eyeY} r="3" fill="#2b2118" />
      <circle cx="62" cy={eyeY} r="3" fill="#2b2118" />
      <rect x="33" y="57" width="14" height="10" rx="5" fill="none" stroke="#2b2118" strokeWidth="1.6" />
      <rect x="53" y="57" width="14" height="10" rx="5" fill="none" stroke="#2b2118" strokeWidth="1.6" />
      <ellipse cx="50" cy="74" rx={state === "happy" ? 9 : 7} ry={mouth} fill="#7a2f2f" />
      {state === "thinking" && <circle cx="80" cy="22" r="4" fill="#fbf7f0" opacity="0.8" />}
    </svg>
  );
}
