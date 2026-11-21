"use client";

// Professor Filipe, final art (D-18): the poses are stacked and cross-faded according to the state (RF-M17-01).
// While speaking he alternates between the two teaching poses (a hand gesture every few seconds) and the whole figure
// moves slightly with the speech level; at rest he breathes. "Reduce motion" keeps the poses but stops the movement.
import type { AvatarState } from "./Avatar";
import { LipSyncFace } from "./LipSyncFace";
import { CANVAS, FACES, POSES, type PoseId } from "./poses";

function poseFor(state: AvatarState): PoseId {
  switch (state) {
    case "thinking": return "think";
    case "happy": return "cheer";
    case "empathetic": return "care";
    case "pointing": return "point";
    case "insight": return "idea";
    case "speaking": return "teach"; // one pose: alternating poses moved the head and dissolved two different renders
    default: return "welcome"; // idle, listening
  }
}

export function AvatarArt({ state, level = 0, mode = "full", className }: { state: AvatarState; level?: number; mode?: "full" | "bust"; className?: string }) {

  if (mode === "bust") {
    // Compact view: ONE face image; only the lower jaw moves with the speech level (see lib/avatar/lipsync.ts), plus a very small nod.
    // The smiling face is a swap (no cross-dissolve): the faces are different renders and dissolving them morphs the head.
    const smile = state === "happy";
    return (
      <div className={`avatar-stage ${className ?? ""}`} aria-hidden="true">
        <div className={`avatar-figure ${state === "speaking" ? "" : "avatar-breathe"}`} style={{ position: "absolute", inset: 0, maskImage: "linear-gradient(to bottom, #000 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 88%, transparent 100%)" }}>
          <LipSyncFace src={smile ? FACES.smile : FACES.closed} level={level} speaking={state === "speaking" && !smile} />
        </div>
      </div>
    );
  }

  const active = poseFor(state);
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
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", opacity: id === active ? 1 : 0, transition: "opacity 380ms ease-in-out" }}
            />
          );
        })}
      </div>
    </div>
  );
}
