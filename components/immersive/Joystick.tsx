"use client";

// Virtual joystick for touch screens (spec 8.16): drag the thumb, the stick vector goes to the engine. A dead zone keeps a resting thumb still.
import { useRef, useState } from "react";
import { stickFromOffset, type V2 } from "@/lib/immersive/movement";

const R = 52; // radius of the base in px

export function Joystick({ onChange, label }: { onChange(v: V2): void; label: string }) {
  const base = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<V2>([0, 0]);
  const active = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    setThumb([dx, dy]);
    onChange(stickFromOffset(dx, dy, R));
  };
  const end = () => { active.current = null; setThumb([0, 0]); onChange([0, 0]); };

  return (
    <div
      ref={base} role="application" aria-label={label} data-testid="joystick"
      className="pointer-events-auto relative h-[116px] w-[116px] touch-none select-none rounded-full border border-white/50 bg-black/25"
      onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) update(e); }}
      onPointerUp={end} onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/70" style={{ transform: `translate(calc(-50% + ${thumb[0]}px), calc(-50% + ${thumb[1]}px))` }} />
    </div>
  );
}
