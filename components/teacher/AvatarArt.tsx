"use client";

// Professor Filipe, final art (D-18): the poses are stacked and cross-faded according to the state (RF-M17-01).
// While speaking he alternates between the two teaching poses (a hand gesture every few seconds) and the whole figure
// moves slightly with the speech level; at rest he breathes. "Reduce motion" keeps the poses but stops the movement.
import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "./Avatar";
import { CANVAS, FACES, POSES, type PoseId } from "./poses";

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

export function AvatarArt({ state, level = 0, mode = "full", className }: { state: AvatarState; level?: number; mode?: "full" | "bust"; className?: string }) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (state !== "speaking") return;
    const id = setInterval(() => setBeat((b) => b + 1), 4500);
    return () => clearInterval(id);
  }, [state]);

  // Compact view: the mouth is a continuous cross-dissolve between the closed face and the open face, smoothed every frame
  // (quick to open, slower to close), so it moves like a mouth instead of flipping between pictures.
  const openRef = useRef<HTMLImageElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const speakingRef = useRef(state === "speaking");
  speakingRef.current = state === "speaking";
  useEffect(() => {
    if (mode !== "bust") return;
    let raf = 0;
    let o = 0;
    const tick = () => {
      const target = speakingRef.current ? Math.min(1, levelRef.current * 3.2) : 0;
      o += (target - o) * (target > o ? 0.3 : 0.14);
      if (openRef.current) openRef.current.style.opacity = String(Math.round(o * 100) / 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  if (mode === "bust") {
    const smile = state === "happy";
    const faceStyle = { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "contain" as const, objectPosition: "50% 100%" };
    return (
      <div className={`avatar-stage ${className ?? ""}`} aria-hidden="true">
        <div className={`avatar-figure ${state === "speaking" ? "" : "avatar-breathe"}`} style={{ position: "absolute", inset: 0, maskImage: "linear-gradient(to bottom, #000 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 88%, transparent 100%)" }}>
          {/* eslint-disable @next/next/no-img-element */}
          <img src={FACES.closed} alt="" draggable={false} style={faceStyle} />
          <img src={FACES.smile} alt="" draggable={false} style={{ ...faceStyle, opacity: smile ? 1 : 0, transition: "opacity 450ms ease" }} />
          <img ref={openRef} src={FACES.open} alt="" draggable={false} style={{ ...faceStyle, opacity: 0 }} />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </div>
    );
  }

  const active = poseFor(state, beat);
  return (
    <div className={`avatar-stage ${className ?? ""}`} aria-hidden="true">
      <div className="avatar-ground" />
      <div className={`avatar-figure ${state === "speaking" ? "" : "avatar-breathe"}`} style={{ position: "absolute", inset: 0 }}>
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
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", opacity: id === active ? 1 : 0, transition: "opacity 700ms ease-in-out" }}
            />
          );
        })}
      </div>
    </div>
  );
}
