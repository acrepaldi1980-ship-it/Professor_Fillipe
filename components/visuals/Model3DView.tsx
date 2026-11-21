"use client";

// 3D viewer (RF-M08-05): rotate, zoom and tap hotspots (text, verses). The scenes are built from primitives (see lib/visuals/models3d.ts).
// Loaded on demand (dynamic import) so the 3D engine never weighs on the rest of the app. With "reduce motion" nothing spins by itself.
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { MODELS_3D, type Hotspot } from "@/lib/visuals/models3d";
import { ArkScene, TabernacleScene, TempleScene } from "./scenes3d/scenes";
import { EXTRA_SCENES } from "./scenes3d/scenes-extra";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Model3DView({ modelId, onOpenRef }: { modelId: string; onOpenRef?(ref: string): void }) {
  const model = useMemo(() => MODELS_3D.find((m) => m.id === modelId), [modelId]);
  const [sel, setSel] = useState<Hotspot | null>(null);
  if (!model) return null;
  const Scene = EXTRA_SCENES[model.id] ?? (model.id === "ark_covenant" ? ArkScene : model.id === "tabernacle" ? TabernacleScene : TempleScene);
  return (
    <figure className="flex h-full min-h-[360px] flex-col gap-2" aria-label={model.name}>
      <div className="min-h-[280px] flex-1 overflow-hidden rounded-control border border-line bg-[#e9dfc8]" role="img" aria-label={model.alt}>
        <Canvas camera={{ position: model.camera, fov: 45 }} dpr={[1, 1.5]} aria-hidden>
          <color attach="background" args={["#efe6d2"]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 8, 5]} intensity={2.2} />
          <directionalLight position={[-4, 3, -3]} intensity={0.6} />
          <Scene />
          {model.hotspots.map((h) => (
            <Html key={h.id} position={h.at} center zIndexRange={[10, 0]}>
              <button type="button" aria-label={h.label} className="map-pin" data-active={sel?.id === h.id ? "1" : "0"} onClick={() => setSel(h)}>+</button>
            </Html>
          ))}
          <OrbitControls enablePan={false} minDistance={2} maxDistance={24} autoRotate={!reduced() && !sel} autoRotateSpeed={0.6} />
        </Canvas>
      </div>
      <div className="rounded-control border border-line bg-surface p-2 text-sm" aria-live="polite">
        {sel ? (
          <>
            <strong>{sel.label}</strong>
            <p>{sel.text}</p>
            <div className="mt-1 flex flex-wrap gap-2">{sel.refs.slice(0, 3).map((r) => <button key={r} type="button" className="rounded-control border border-line px-2 py-1 text-xs underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}</div>
          </>
        ) : <p className="text-muted">{t("model3d.hint")}</p>}
      </div>
      <ul className="sr-only">{model.hotspots.map((h) => <li key={h.id}>{h.label}: {h.text}</li>)}</ul>
      <figcaption className="text-xs text-muted">{model.note}</figcaption>
    </figure>
  );
}
