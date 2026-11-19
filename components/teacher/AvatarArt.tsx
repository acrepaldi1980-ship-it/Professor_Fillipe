"use client";

// Professor Filipe, final art (D-18): the poses are stacked and cross-faded according to the state (RF-M17-01).
// While speaking he alternates between the two teaching poses (a hand gesture every few seconds) and the whole figure
// moves slightly with the speech level; at rest he breathes. "Reduce motion" keeps the poses but stops the movement.
import { useEffect, useState } from "react";
import type { AvatarState } from "./Avatar";
import { CANVAS, FACES, POSES, type FaceId, type PoseId } from "./poses";

function poseFor(state: AvatarState, beat: number): PoseId {
  switch (state) {
    case "thinking": return "think";
    case "happy": return "cheer";
    case "empathetic": return "care";
    case "pointing": return "point";
    case "insight": return "idea";
    case "speaking": return beat % 2 === 0 ? "teach" : "teachHand";
    default: return "welcome"; // idle, listening
  }
}

function faceFor(state: AvatarState, level: number): FaceId {
  if (state === "happy") return "smile";
  if (state !== "speaking") return "closed";
  const lv = Math.min(1, level * 3.2);
  return lv < 0.1 ? "closed" : lv < 0.45 ? "talk" : "open";
}

export function AvatarArt({ state, level = 0, mode = "full", className }: { state: AvatarState; level?: number; mode?: "full" | "bust"; className?: string }) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (state !== "speaking") return;
    const id = setInterval(() => setBeat((b) => b + 1), 2600);
    return () => clearInterval(id);
  }, [state]);

  if (mode === "bust") {
    // Compact view: head and shoulders, with the mouth following the speech level.
    const face = faceFor(state, level);
    return (
      <div className={`avatar-stage ${className ?? ""}`} aria-hidden="true">
        <div className={`avatar-figure ${state === "speaking" ? "" : "avatar-breathe"}`} style={{ position: "absolute", inset: 0, maskImage: "linear-gradient(to bottom, #000 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 88%, transparent 100%)" }}>
          {(Object.keys(FACES) as FaceId[]).map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={FACES[id]} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", opacity: id === face ? 1 : 0 }} />
          ))}
        </div>
      </div>
    );
  }

  const active = poseFor(state, beat);
  const speaking = state === "speaking";
  const lv = Math.min(1, level * 3.2);
  const bounce = speaking ? lv * 6 : 0;

  return (
    <div className={`avatar-stage ${className ?? ""}`} aria-hidden="true">
      <div className="avatar-ground" />
      <div className={`avatar-figure ${speaking ? "" : "avatar-breathe"}`} style={{ position: "absolute", inset: 0, transform: `translateY(${-bounce}px)`, transition: "transform 90ms linear" }}>
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
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", opacity: id === active ? 1 : 0, transition: "opacity 380ms ease" }}
            />
          );
        })}
      </div>
    </div>
  );
}
