"use client";

// Professor Filipe, final art (D-18): the poses are stacked and cross-faded according to the state (RF-M17-01).
// While speaking he alternates between the two teaching poses (a hand gesture every few seconds) and the whole figure
// moves slightly with the speech level; at rest he breathes. "Reduce motion" keeps the poses but stops the movement.
import { useEffect, useState } from "react";
import type { AvatarState } from "./Avatar";
import { CANVAS, POSES, type PoseId } from "./poses";

function poseFor(state: AvatarState, beat: number): PoseId {
  switch (state) {
    case "thinking": return "think";
    case "happy": return "cheer";
    case "empathetic": return "care";
    case "pointing": return "teach";
    case "speaking": return beat % 2 === 0 ? "teach" : "teachHand";
    default: return "welcome"; // idle, listening
  }
}

export function AvatarArt({ state, level = 0, mode = "full", className }: { state: AvatarState; level?: number; mode?: "full" | "bust"; className?: string }) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (state !== "speaking") return;
    const id = setInterval(() => setBeat((b) => b + 1), 2600);
    return () => clearInterval(id);
  }, [state]);

  const active = poseFor(state, beat);
  const speaking = state === "speaking";
  const lv = Math.min(1, level * 3.2);
  const bounce = speaking ? lv * 6 : 0;
  const bust = mode === "bust";

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} aria-hidden="true" style={{ aspectRatio: undefined }}>
      <div className={speaking ? "" : "avatar-breathe"} style={{ position: "absolute", inset: 0, transform: `translateY(${-bounce}px)`, transition: "transform 90ms linear" }}>
        {(Object.keys(POSES) as PoseId[]).map((id) => {
          const p = POSES[id];
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={id}
              src={p.src}
              alt=""
              draggable={false}
              width={CANVAS.w}
              height={CANVAS.h}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "50% 100%",
                opacity: id === active ? 1 : 0,
                transition: "opacity 380ms ease, transform 500ms ease",
                // compact mode: zoom to head and shoulders, centred on the head of that pose
                transformOrigin: `${(p.cx / CANVAS.w) * 100}% 0%`,
                transform: bust ? "scale(2.1) translateY(1%)" : "scale(1)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
