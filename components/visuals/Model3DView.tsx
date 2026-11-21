"use client";

// 3D viewer (RF-M08-05): rotate, zoom and tap hotspots (text, verses). The scenes are built from primitives (see lib/visuals/models3d.ts).
// Loaded on demand (dynamic import) so the 3D engine never weighs on the rest of the app. With "reduce motion" nothing spins by itself.
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Box3, Vector3 } from "three";
import { getModel3d, type RemoteModel3D } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { MODELS_3D, type Hotspot, type Model3D } from "@/lib/visuals/models3d";
import { Ground, Studio } from "./scenes3d/scenes";
import { ArkScene, TabernacleScene, TempleScene } from "./scenes3d/scenes";
import { EXTRA_SCENES } from "./scenes3d/scenes-extra";
import { EXTRA_SCENES_2 } from "./scenes3d/scenes-extra2";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A model uploaded from /admin (GLB): scaled to fit 4 units, centred and sitting on the ground, so the hotspots are given in the same units in the preview and for the student. */
function GlbScene({ url, onPick }: { url: string; onPick?(p: [number, number, number]): void }) {
  const gltf = useGLTF(url);
  const obj = useMemo(() => {
    const c = gltf.scene.clone(true);
    const b = new Box3().setFromObject(c), size = b.getSize(new Vector3());
    c.scale.setScalar(4 / Math.max(size.x, size.y, size.z, 0.001));
    const b2 = new Box3().setFromObject(c), ctr = b2.getCenter(new Vector3());
    c.position.set(-ctr.x, -b2.min.y, -ctr.z);
    return c;
  }, [gltf]);
  return (
    <>
      <Studio />
      <Ground size={20} />
      <primitive object={obj} onPointerDown={(e: { point: Vector3; stopPropagation(): void }) => { if (onPick) { e.stopPropagation(); onPick([+e.point.x.toFixed(2), +e.point.y.toFixed(2), +e.point.z.toFixed(2)]); } }} />
    </>
  );
}

const asModel = (r: RemoteModel3D): Model3D => ({ id: r.id, name: r.name, alt: r.alt, note: r.note, camera: r.camera, hotspots: r.hotspots });

/** `remote` lets the admin preview a model that is not saved yet; `onPick` reports the point tapped on the model (to place hotspots). */
export default function Model3DView({ modelId, onOpenRef, remote, onPick }: { modelId: string; onOpenRef?(ref: string): void; remote?: RemoteModel3D | null; onPick?(p: [number, number, number]): void }) {
  const code = useMemo(() => MODELS_3D.find((m) => m.id === modelId), [modelId]);
  const [fetched, setFetched] = useState<RemoteModel3D | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (!code && !remote) void getModel3d(modelId).then(setFetched).catch(() => setFailed(true)); }, [code, remote, modelId]);
  const rm = remote ?? fetched;
  const model = code ?? (rm ? asModel(rm) : undefined);
  const [sel, setSel] = useState<Hotspot | null>(null);
  if (!model) return failed ? <p role="alert" className="text-sm">{t("model3d.error")}</p> : <p role="status" className="text-sm text-muted">{t("word.loading")}</p>;
  const Scene = code ? (EXTRA_SCENES[model.id] ?? EXTRA_SCENES_2[model.id] ?? (model.id === "ark_covenant" ? ArkScene : model.id === "tabernacle" ? TabernacleScene : TempleScene)) : () => (rm?.file_url ? <GlbScene url={rm.file_url} onPick={onPick} /> : null);
  return (
    <figure className="flex h-full min-h-[360px] flex-col gap-2" aria-label={model.name}>
      <div className="min-h-[280px] flex-1 overflow-hidden rounded-control border border-line bg-[#e9dfc8]" role="img" aria-label={model.alt}>
        <Canvas camera={{ position: model.camera, fov: 45 }} dpr={[1, 1.5]} aria-hidden>
          <color attach="background" args={["#efe6d2"]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 8, 5]} intensity={2.2} />
          <directionalLight position={[-4, 3, -3]} intensity={0.6} />
          <Suspense fallback={null}><Scene /></Suspense>
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
