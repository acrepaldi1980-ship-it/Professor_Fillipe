"use client";

// The compact face of the teacher with a natural, single-image mouth (see lib/avatar/lipsync.ts).
import { useEffect, useRef } from "react";
import { drawFace, FACE_MOUTH, stepMotion } from "@/lib/avatar/lipsync";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function LipSyncFace({ src, level, speaking, className }: { src: string; level: number; speaking: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef({ level, speaking });
  live.current = { level, speaking };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.src = src;
    let raf = 0;
    let state = { drop: 0, nod: 0 };
    let last = -1;
    const calm = reduced();
    const tick = (t: number) => {
      const { level: lv, speaking: sp } = live.current;
      state = stepMotion(state, calm ? 0 : lv, sp && !calm, t);
      const drop = Math.round(state.drop * FACE_MOUTH.maxDrop * 4) / 4;
      if (img.complete && (drop !== last || last < 0)) {
        drawFace(ctx, img, FACE_MOUTH, drop);
        last = drop;
      }
      if (wrap.current) wrap.current.style.transform = `rotate(${state.nod.toFixed(2)}deg) translateY(${(-state.drop * 1.5).toFixed(2)}px)`;
      raf = requestAnimationFrame(tick);
    };
    img.onload = () => { last = -1; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src]);

  return (
    <div ref={wrap} className={className} style={{ width: "100%", height: "100%", transformOrigin: "50% 100%", willChange: "transform" }}>
      <canvas ref={canvas} width={FACE_MOUTH.w} height={FACE_MOUTH.h} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%" }} />
    </div>
  );
}
