"use client";

import { useId } from "react";

// Professor Filipe — provisional avatar, style "Suave" (D-13/D-18, chosen by the owner on 18/11/2026).
// States follow spec RF-M17-01; the mouth follows the audio level (RF-M17-02, stops as soon as the level is 0).
// Decorative for screen readers (aria-hidden): the current state is announced as text by the screen.
// Motion (breathing, blinking) is switched off by the global prefers-reduced-motion rule.
export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "empathetic" | "pointing";

export function Avatar({ state, level = 0, size = 112, animated = true }: { state: AvatarState; level?: number; size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, "");
  const speaking = state === "speaking";
  const open = speaking ? Math.min(1, level * 3.2) : 0; // 0..1
  const happy = state === "happy";
  const thinking = state === "thinking";
  const listening = state === "listening";
  const empathetic = state === "empathetic";

  // eyes
  const eyeRy = listening ? 6.4 : 5.4;
  const pupilDx = thinking ? 2.5 : 0;
  const pupilDy = thinking ? -3 : 0;
  // eyebrows: raised when listening/thinking, inner ends up when empathetic
  const browL = empathetic ? "M82 94q16-6 32-1" : listening ? "M82 85q16-10 32 0" : thinking ? "M82 86q16-9 32-1" : "M82 90q16-9 32 0";
  const browR = empathetic ? "M126 93q16-5 32 1" : listening ? "M126 85q16-10 32 0" : thinking ? "M126 90q16-9 32 0" : "M126 90q16-9 32 0";
  // mouth (inside the beard): closed smile, or open by audio level
  const my = 148;
  const mouthPath = speaking
    ? `M104 ${my}q16 ${4 + open * 22} 32 0q-16 ${2 + open * 8} -32 0Z`
    : happy
      ? `M100 ${my - 1}q20 22 40 0q-20 8 -40 0Z`
      : empathetic
        ? `M106 ${my + 2}q14 8 28 0q-14 3 -28 0Z`
        : thinking
          ? `M110 ${my + 3}q10 4 20 0q-10 1 -20 0Z`
          : `M102 ${my}q18 14 36 0q-18 6 -36 0Z`;
  const mouthFill = speaking && open > 0.12 ? "#4a1a14" : "#fbf3e6";

  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 240 240" style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="40%"><stop offset="0" stopColor="#fbeed6" /><stop offset="1" stopColor="#ecd2a6" /></radialGradient>
        <radialGradient id={`sk${id}`} cx="42%" cy="35%"><stop offset="0" stopColor="#e0a678" /><stop offset="1" stopColor="#b87a50" /></radialGradient>
        <linearGradient id={`sw${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cf6a3c" /><stop offset="1" stopColor="#9c4320" /></linearGradient>
        <clipPath id={`c${id}`}><circle cx="120" cy="120" r="116" /></clipPath>
      </defs>
      <circle cx="120" cy="120" r="118" fill={`url(#bg${id})`} />
      <g clipPath={`url(#c${id})`}>
        <g style={animated && state === "idle" ? { animation: "avatar-breathe 4s ease-in-out infinite", transformOrigin: "120px 200px" } : undefined}>
          <path d="M20 240C24 190 70 174 120 174s96 16 100 66Z" fill={`url(#sw${id})`} />
          <path d="M92 176 120 214 148 176Z" fill="#f8efe0" />
          <path d="M120 214v26" stroke="#9c4320" strokeWidth="3" />
          <circle cx="120" cy="226" r="3" fill="#7a3418" />
          {state === "pointing" && (
            <g>
              <circle cx="196" cy="172" r="18" fill="#cf6a3c" />
              <path d="M188 172h16m-6-7 7 7-7 7" stroke="#fff4e0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          )}
          <g style={{ transform: listening ? "rotate(-4deg)" : "none", transformOrigin: "120px 180px", transition: "transform var(--motion, 200ms) ease" }}>
            <path d="M102 146h36v34q-18 16-36 0Z" fill="#a8693f" />
            <ellipse cx="68" cy="116" rx="9" ry="14" fill="#b87a50" />
            <ellipse cx="172" cy="116" rx="9" ry="14" fill="#b87a50" />
            <ellipse cx="120" cy="112" rx="54" ry="62" fill={`url(#sk${id})`} />
            <path d="M66 102C60 54 90 32 120 32c32 0 60 22 54 70-6-18-24-32-54-32S72 84 66 102Z" fill="#2a1d17" />
            <path d="M68 100c-1-8 0-14 3-20M172 100c1-8 0-14-3-20" stroke="#9b9186" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M70 124c2 38 24 56 50 56s48-18 50-56c-8 22-24 30-50 30s-42-8-50-30Z" fill="#33251d" />
            <path d="M98 140q10-8 22-2 12-6 22 2-10 8-22 4-12 4-22-4Z" fill="#33251d" />
            <path d={mouthPath} fill={mouthFill} />
            <path d="M120 108q-7 16-2 22 7 4 12-2" stroke="#8c5634" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {happy ? (
              <g stroke="#241711" strokeWidth="4.5" strokeLinecap="round" fill="none"><path d="M91 111q7-8 14 0" /><path d="M135 111q7-8 14 0" /></g>
            ) : (
              <g style={animated ? { animation: "avatar-blink 5s infinite", transformOrigin: "120px 108px", transformBox: "fill-box" } : undefined}>
                <ellipse cx={98 + pupilDx} cy={108 + pupilDy} rx="4.2" ry={eyeRy} fill="#241711" />
                <ellipse cx={142 + pupilDx} cy={108 + pupilDy} rx="4.2" ry={eyeRy} fill="#241711" />
                <circle cx={99.5 + pupilDx} cy={106 + pupilDy} r="1.4" fill="#fff" />
                <circle cx={143.5 + pupilDx} cy={106 + pupilDy} r="1.4" fill="#fff" />
              </g>
            )}
            <path d={browL} stroke="#2a1d17" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d={browR} stroke="#2a1d17" strokeWidth="5" strokeLinecap="round" fill="none" />
            <g fill="rgba(255,255,255,.16)" stroke="#b4532a" strokeWidth="4"><circle cx="98" cy="108" r="19" /><circle cx="142" cy="108" r="19" /></g>
            <path d="M116 104q4-5 8 0" stroke="#b4532a" strokeWidth="4" fill="none" />
            <path d="M79 104 69 104M161 104l10 0" stroke="#b4532a" strokeWidth="4" />
            <path d="M88 100a14 14 0 0 1 12-6" stroke="rgba(255,255,255,.7)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="80" cy="130" r="8" fill="#e58f6b" opacity={happy ? 0.55 : 0.35} />
            <circle cx="160" cy="130" r="8" fill="#e58f6b" opacity={happy ? 0.55 : 0.35} />
            {thinking && (
              <g fill="#fbf3e6" opacity="0.95"><circle cx="166" cy="52" r="4" /><circle cx="177" cy="43" r="5.5" /><circle cx="188" cy="33" r="7" /></g>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
