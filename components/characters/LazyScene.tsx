"use client";

// Draws a scene only when it is near the screen: a page of illustrations (the list of lives, a book with 19 chapters) used to build dozens of SVGs with
// heavy filters at once, which froze phones. `light` skips the painterly filters for small covers.
import { useEffect, useRef, useState } from "react";
import type { SceneSpec } from "@/lib/characters/schema";
import { SceneArt } from "./SceneArt";

export function LazyScene({ spec, seed, className, light = false, color = "#d9c9a8" }: { spec: SceneSpec; seed: number; className?: string; light?: boolean; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: "500px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  return <div ref={ref} className={className} style={on ? undefined : { background: color, opacity: 0.6 }}>{on ? <SceneArt spec={spec} seed={seed} light={light} className="block h-full w-full" /> : null}</div>;
}
