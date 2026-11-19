"use client";

// Professor Filipe: compact round avatar (head crop of the final art, D-18) for headers, icons and small spots.
// Decorative for screen readers (aria-hidden): the current state is announced as text by the screen.
import { CANVAS, POSES, type PoseId } from "./poses";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "empathetic" | "pointing";

const POSE_OF: Record<AvatarState, PoseId> = { idle: "welcome", listening: "welcome", empathetic: "care", thinking: "think", speaking: "welcome", happy: "welcome", pointing: "welcome" }; // poses without a raised hand fit the round crop
const WINDOW = 280; // width in canvas pixels of the head crop

export function Avatar({ state, level = 0, size = 112, animated = true }: { state: AvatarState; level?: number; size?: number; animated?: boolean }) {
  const pose = POSES[POSE_OF[state]];
  const k = size / WINDOW;
  const bob = animated && state === "speaking" ? Math.min(1, level * 3.2) * 3 : 0;
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "var(--color-surface, #f6efe2)", position: "relative", flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pose.src}
        alt=""
        draggable={false}
        style={{ position: "absolute", width: CANVAS.w * k, height: CANVAS.h * k, left: -(pose.cx - WINDOW / 2) * k, top: (6 - bob) * k, maxWidth: "none" }}
      />
    </div>
  );
}
