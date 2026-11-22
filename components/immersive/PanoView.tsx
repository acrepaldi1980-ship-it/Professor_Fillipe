"use client";

// 360° photo tours (Prompt 3.5b): real photographs, look around by dragging, move by tapping the arrows in the photo or the place chips,
// pins with text and verses, the voice teacher who knows what the student is looking at, and the credit of every photo always on screen.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackSide, CanvasTexture, LinearFilter, SRGBColorSpace, TextureLoader, type Texture } from "three";
import { Button } from "@/components/ui/Button";
import { closeSessionFull, createSession, teacherTurn, transcribeAudio } from "@/lib/api-client";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { type PanoScene, type PanoTour, coverageFor, lookedAt, project, yawDiff } from "@/lib/immersive/pano";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { getPlatform } from "@/lib/platform";
import { speakText, stopSpeaking } from "@/lib/voice/client-speak";

interface Cam { yaw: number; pitch: number; fov: number; vy: number; vp: number }
const FOV_MIN = 35, FOV_MAX = 95;
/** Turns the sphere so the center of the photo (u = 0.5) is at yaw 0 (checked on a test image with labels). */
const SPHERE_TURN = -Math.PI / 2;

/** The photo on the sphere. A full 360° panorama covers it all; a flat photo is a patch on the sphere with the rest filled by a blurred, darkened copy of the same photo (so there is no black void). */
function Sphere({ texture, coverage }: { texture: Texture | null; coverage: { h: number; v: number; full: boolean } }) {
  const backdrop = useMemo(() => {
    if (!texture || coverage.full) return null;
    const img = texture.image as CanvasImageSource & { width: number; height: number };
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.filter = "blur(14px) brightness(0.55) saturate(0.9)";
    const k = Math.max(c.width / img.width, c.height / img.height);
    ctx.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k);
    const tx = new CanvasTexture(c); tx.colorSpace = SRGBColorSpace; return tx;
  }, [texture, coverage.full]);
  useEffect(() => () => backdrop?.dispose(), [backdrop]);
  if (!texture) return null;
  const phiLen = (coverage.h * Math.PI) / 180, thetaLen = (coverage.v * Math.PI) / 180;
  return (
    <>
      {backdrop && (
        <mesh scale={[-1, 1, 1]} rotation={[0, SPHERE_TURN, 0]}>
          <sphereGeometry args={[58, 32, 20]} />
          <meshBasicMaterial map={backdrop} side={BackSide} toneMapped={false} />
        </mesh>
      )}
      <mesh scale={[-1, 1, 1]} rotation={[0, SPHERE_TURN, 0]}>
        {coverage.full ? <sphereGeometry args={[50, 64, 40]} /> : <sphereGeometry args={[50, 48, 32, Math.PI - phiLen / 2, phiLen, Math.PI / 2 - thetaLen / 2, thetaLen]} />}
        <meshBasicMaterial map={texture} side={BackSide} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Applies the camera state (kept in a ref, owned by the view) to the three.js camera, with inertia after a drag. */
function CameraRig({ cam }: { cam: React.MutableRefObject<Cam> }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const c = cam.current;
    c.yaw += c.vy * dt; c.pitch = Math.max(-85, Math.min(85, c.pitch + c.vp * dt));
    const k = Math.pow(0.02, dt); c.vy *= k; c.vp *= k;
    if (Math.abs(c.vy) < 0.05) c.vy = 0;
    if (Math.abs(c.vp) < 0.05) c.vp = 0;
    if (c.yaw > 180) c.yaw -= 360; if (c.yaw < -180) c.yaw += 360;
    const cc = camera as import("three").PerspectiveCamera;
    cc.fov = c.fov; cc.updateProjectionMatrix();
    camera.rotation.set((c.pitch * Math.PI) / 180, (-c.yaw * Math.PI) / 180, 0, "YXZ");
  });
  return null;
}

/** The photo source: a link labeled with the site (long file URLs would crowd the screen), or plain text. */
function CreditSource({ source }: { source: string }) {
  if (!/^https?:\/\//.test(source)) return <>{source}</>;
  let label = source;
  try { const h = new URL(source).hostname; label = h === "commons.wikimedia.org" ? "Wikimedia Commons" : h; } catch { /* keep the raw text */ }
  return <a href={source} target="_blank" rel="noreferrer" className="underline">{label}</a>;
}

export default function PanoView({ tour, initial, onOpenRef }: { tour: PanoTour; initial?: string; onOpenRef?(ref: string): void }) {
  const router = useRouter();
  const first = tour.scenes.find((s) => s.id === initial) ?? tour.scenes.find((s) => s.id === tour.start) ?? tour.scenes[0];
  const [sceneId, setSceneId] = useState(first.id);
  const scene: PanoScene = tour.scenes.find((s) => s.id === sceneId) ?? first;
  const [texture, setTexture] = useState<Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [fade, setFade] = useState(true);
  const [open, setOpen] = useState<PanoScene["hotspots"][number] | null>(null);
  const [sheet, setSheet] = useState(false);
  const [ask, setAsk] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ who: "me" | "teacher"; text: string; options?: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const sessionId = useRef<string | null>(null);
  const cam = useRef<Cam>({ yaw: first.startYaw, pitch: 0, fov: 75, vy: 0, vp: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const pinEls = useRef<Record<string, HTMLElement | null>>({});
  const cache = useRef<Map<string, Texture>>(new Map());
  const coverage = useMemo(() => { const im = texture?.image as { width?: number; height?: number } | undefined; return coverageFor(im?.width ?? 2, im?.height ?? 1, scene.coverage); }, [texture, scene.coverage]);
  const [gazeId, setGazeId] = useState<string | null>(null);

  const loadTexture = useCallback((url: string): Promise<Texture> => {
    const hit = cache.current.get(url);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      new TextureLoader().load(url, (tx) => { tx.colorSpace = SRGBColorSpace; tx.minFilter = LinearFilter; tx.generateMipmaps = false; cache.current.set(url, tx); resolve(tx); }, undefined, () => reject(new Error("image")));
    });
  }, []);

  // load the photo of the current scene, then preload the neighbors (so tapping an arrow is nearly instant)
  useEffect(() => {
    let alive = true;
    setLoading(true); setFailed(false);
    loadTexture(scene.image).then((tx) => { if (!alive) return; setTexture(tx); { const im = tx.image as { width: number; height: number }; const cv = coverageFor(im.width, im.height, scene.coverage); cam.current.fov = cv.full ? 75 : cv.h / cv.v > 2.2 ? 55 : Math.max(FOV_MIN, Math.min(75, cv.v * 1.12)); } setLoading(false); setFade(false); scene.links.forEach((l) => { const n = tour.scenes.find((s) => s.id === l.to); if (n) void loadTexture(n.image).catch(() => undefined); }); }).catch(() => { if (alive) { setFailed(true); setLoading(false); setFade(false); } });
    return () => { alive = false; };
  }, [scene, tour, loadTexture]);
  useEffect(() => () => { stopSpeaking(); cache.current.forEach((tx) => tx.dispose()); }, []);

  function go(id: string, arriveYaw?: number) {
    const dest = tour.scenes.find((s) => s.id === id);
    if (!dest || id === sceneId) return;
    stopSpeaking(); setSpeaking(false); setOpen(null); setFade(true);
    window.setTimeout(() => { cam.current.yaw = arriveYaw ?? dest.startYaw; cam.current.pitch = 0; cam.current.vy = 0; cam.current.vp = 0; setSceneId(id); }, 220);
  }

  // looking: drag (mouse and touch), wheel and pinch zoom, arrow keys
  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<number | null>(null);
  const perPixel = () => (cam.current.fov / Math.max(300, wrap.current?.clientHeight ?? 600));
  const onPointerDown = (e: React.PointerEvent) => {
    setHint(false);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    cam.current.vy = 0; cam.current.vp = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) cam.current.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, cam.current.fov * (pinch.current / d)));
      pinch.current = d; return;
    }
    const d0 = drag.current;
    if (!d0 || d0.id !== e.pointerId) return;
    const dx = e.clientX - d0.x, dy = e.clientY - d0.y;
    d0.x = e.clientX; d0.y = e.clientY; d0.moved += Math.abs(dx) + Math.abs(dy);
    const k = perPixel();
    cam.current.yaw -= dx * k; cam.current.pitch = Math.max(-85, Math.min(85, cam.current.pitch + dy * k));
    cam.current.vy = (-dx * k) * 30; cam.current.vp = (dy * k) * 30;
  };
  const onPointerUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); pinch.current = null; if (drag.current?.id === e.pointerId) drag.current = null; };
  const onWheel = (e: React.WheelEvent) => { cam.current.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, cam.current.fov + e.deltaY * 0.04)); };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /input|textarea/i.test(el.tagName)) return;
      const c = cam.current;
      if (e.key === "ArrowLeft" || e.key === "a") c.vy = -60; else if (e.key === "ArrowRight" || e.key === "d") c.vy = 60;
      else if (e.key === "ArrowUp" || e.key === "w") c.vp = 40; else if (e.key === "ArrowDown" || e.key === "s") c.vp = -40;
      else if (e.key === "+" || e.key === "=") c.fov = Math.max(FOV_MIN, c.fov - 6); else if (e.key === "-") c.fov = Math.min(FOV_MAX, c.fov + 6);
      else if (e.key === "Escape") setOpen(null); else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // pins: positioned on the DOM every frame from the camera state, so they stay glued to the photo without re-rendering React
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (now: number) => {
      const el = wrap.current;
      if (el) {
        const c = cam.current, aspect = el.clientWidth / Math.max(1, el.clientHeight);
        const place = (id: string, yaw: number, pitch: number) => {
          const node = pinEls.current[id]; if (!node) return;
          const p = project(yaw, pitch, c.yaw, c.pitch, c.fov, aspect);
          if (!p || p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1) { node.style.display = "none"; return; }
          node.style.display = "flex"; node.style.left = `${p.x * 100}%`; node.style.top = `${p.y * 100}%`;
        };
        scene.hotspots.forEach((h) => place(`h:${h.id}`, h.yaw, h.pitch));
        scene.links.forEach((l) => place(`l:${l.to}`, l.yaw, l.pitch));
        if (now - last > 200) { last = now; const g = lookedAt(scene.hotspots, c.yaw, c.pitch, 16); setGazeId((cur) => (cur === (g?.id ?? null) ? cur : g?.id ?? null)); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  // the teacher
  async function say(text: string) { setSpeaking(true); try { await speakText(text); } finally { setSpeaking(false); } }
  async function sendQuestion(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setBusy(true); setErr(null); setQuestion("");
    setThread((th) => [...th, { who: "me", text }]);
    try {
      if (!sessionId.current) sessionId.current = (await createSession("free")).sessionId;
      const { response } = await teacherTurn({ sessionId: sessionId.current, text, pano: { tour: tour.id, scene: scene.id, hotspot: open?.id ?? null, yaw: cam.current.yaw, pitch: cam.current.pitch } });
      setThread((th) => [...th, { who: "teacher", text: response.display_markdown || response.speech, options: response.next_options.map((o) => o.label).slice(0, 3) }]);
      void say(response.speech);
    } catch { setErr(t("imm.ask.error")); }
    setBusy(false);
  }
  async function toggleMic() {
    const mic = getPlatform().microphone;
    if (!recording) { try { await mic.start(); setRecording(true); } catch { setErr(t("study.error.mic")); } return; }
    setRecording(false);
    try { const blob = await mic.stop(); const r = await transcribeAudio(blob); if (r.text.trim()) await sendQuestion(r.text); else setErr(t("study.error.heard")); } catch { setErr(t("study.error.heard")); }
  }
  async function finish() {
    stopSpeaking();
    const id = sessionId.current;
    if (id) { try { await closeSessionFull(id); } catch { /* the closing screen retries */ } router.push(`/fechamento?s=${id}`); } else router.back();
  }
  const gaze = useMemo(() => scene.hotspots.find((h) => h.id === gazeId) ?? null, [scene, gazeId]);
  const index = tour.scenes.findIndex((s) => s.id === scene.id);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden bg-black" data-testid="pano" role="application" aria-label={`${tour.title}: ${scene.title}. ${t("pano.keys")}`}>
      <div className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
        <Canvas dpr={[1, 2]} camera={{ fov: 75, near: 0.1, far: 200, position: [0, 0, 0] }} gl={{ antialias: true }} aria-hidden>
          <Sphere texture={texture} coverage={coverage} />
          <CameraRig cam={cam} />
        </Canvas>
      </div>
      <div className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-200 ${fade ? "opacity-100" : "opacity-0"}`} aria-hidden />

      {/* arrows to move and pins to learn: glued to the photo */}
      {!fade && scene.links.map((l) => (
        <button key={l.to} type="button" ref={(el) => { pinEls.current[`l:${l.to}`] = el; }} data-testid={`pano-link-${l.to}`} aria-label={l.label} onClick={() => go(l.to, l.arriveYaw)}
          style={{ display: "none" }} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-black/50 text-2xl text-white shadow-lg backdrop-blur-sm">➤</span>
          <span className="rounded bg-black/65 px-2 py-0.5 text-xs text-white">{l.label}</span>
        </button>
      ))}
      {!fade && scene.hotspots.map((h) => (
        <button key={h.id} type="button" ref={(el) => { pinEls.current[`h:${h.id}`] = el; }} data-testid={`pano-pin-${h.id}`} aria-label={h.label} onClick={() => { setOpen(h); setHint(false); }}
          style={{ display: "none" }} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-ink shadow-lg ring-2 ring-white">i</span>
          <span className={`rounded bg-black/65 px-2 py-0.5 text-xs text-white ${gaze?.id === h.id ? "" : "opacity-80"}`}>{h.label}</span>
        </button>
      ))}

      <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
        <div className="pointer-events-auto rounded-control bg-black/55 px-3 py-1 text-sm text-white"><strong>{scene.title}</strong> <span className="opacity-75">· {tour.title}</span></div>
        <div className="pointer-events-auto flex gap-2">
          <button type="button" data-testid="pano-ask" onClick={() => setAsk((a) => !a)} className="min-h-9 rounded-control bg-primary px-3 text-sm font-semibold text-primary-ink">{t("imm.ask")}</button>
          <button type="button" onClick={() => setSheet(true)} className="min-h-9 rounded-control bg-black/55 px-3 text-sm text-white">{t("imm.sheet")}</button>
          <button type="button" data-testid="pano-finish" onClick={() => void finish()} className="min-h-9 rounded-control bg-black/55 px-3 text-sm text-white">{t("imm.finish")}</button>
        </div>
      </div>

      {hint && !loading && <p className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white" role="status">{t("pano.hint")}</p>}
      {loading && <p className="absolute inset-0 flex items-center justify-center text-white" role="status">{t("common.loading")}</p>}
      {failed && <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-control bg-black/70 p-3 text-center text-white" role="alert">{t("pano.error")}</p>}

      {/* places: tap to go (works with one finger, no walking needed) */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
        <div className="flex items-center gap-2">
          {scene.script && <button type="button" data-testid="pano-listen" disabled={speaking} onClick={() => void say(scene.script!)} className="min-h-9 shrink-0 rounded-control bg-white/25 px-3 text-sm text-white">{speaking ? "…" : t("imm.listen")}</button>}
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label={t("pano.places")}>
            {tour.scenes.map((s, i) => (
              <button key={s.id} type="button" role="tab" aria-selected={s.id === scene.id} data-testid={`pano-place-${s.id}`} onClick={() => go(s.id)} className={`min-h-9 shrink-0 rounded-control px-3 text-sm ${s.id === scene.id ? "bg-primary font-semibold text-primary-ink" : "bg-black/55 text-white"}`}>{i + 1}. {s.title}</button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-white/80" data-testid="pano-credit">{t("pano.credit")}: {scene.credit.author} · {scene.credit.license} · <CreditSource source={scene.credit.source} /> · {index + 1}/{tour.scenes.length}</p>
      </div>

      {open && (
        <div className="absolute inset-x-2 bottom-24 rounded-control border border-line bg-surface p-3 text-sm shadow-lg" role="dialog" aria-label={open.label} data-testid="pano-panel">
          <strong>{open.label}</strong>
          <p className="mt-1">{open.text}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {open.refs.slice(0, 3).map((r) => <button key={r} type="button" className="min-h-9 rounded-control border border-line px-3 underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{t("study.verse.close")}</Button>
          </div>
        </div>
      )}

      {ask && (
        <div className="absolute inset-x-2 bottom-24 flex max-h-[50%] flex-col gap-2 rounded-control border border-line bg-surface p-3 text-sm shadow-lg" role="dialog" aria-label={t("imm.ask")} data-testid="pano-chat">
          <div className="flex-1 overflow-auto" aria-live="polite">
            {!thread.length && <p className="text-muted">{t("imm.ask.hint")}</p>}
            {thread.map((m, i) => (
              <div key={i} className="mb-2">
                <strong>{m.who === "me" ? t("study.you") : t("study.teacher")}</strong>
                <p className="whitespace-pre-line" data-testid={m.who === "teacher" ? "pano-answer" : undefined}>{m.text}</p>
                {m.who === "teacher" && i === thread.length - 1 && !!m.options?.length && <div className="mt-1 flex flex-wrap gap-1">{m.options.map((o) => <button key={o} type="button" className="min-h-8 rounded-control border border-line px-2 text-xs" onClick={() => void sendQuestion(o)}>{o}</button>)}</div>}
              </div>
            ))}
            {busy && <p role="status" className="text-muted">{t("study.status.thinking")}</p>}
            {err && <p role="alert">{err}</p>}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void sendQuestion(question); }}>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("study.placeholder")} aria-label={t("study.placeholder")} className="min-h-10 flex-1 rounded-control border border-line bg-bg px-3" />
            <button type="button" aria-pressed={recording} aria-label={recording ? t("study.mic.stop") : t("study.mic.start")} onClick={() => void toggleMic()} className="min-h-10 rounded-control border border-line px-3">{recording ? "■" : "🎤"}</button>
            <button type="submit" disabled={busy} className="min-h-10 rounded-control bg-primary px-3 font-semibold text-primary-ink">{t("study.send")}</button>
          </form>
        </div>
      )}

      {sheet && (
        <div className="absolute inset-0 overflow-auto bg-black/60 p-4" role="dialog" aria-label={t("imm.sheet")} data-testid="pano-sheet">
          <div className="mx-auto max-w-md rounded-control bg-surface p-4 text-sm">
            <h2 className="text-lg">{t("imm.sheet")}</h2>
            <p className="mt-1">{tour.sheet.summary}</p>
            <h3 className="mt-3 font-semibold">{t("imm.sources")}</h3>
            <ul className="list-disc pl-5">{tour.sheet.sources.map((s) => <li key={s}>{s}</li>)}</ul>
            {tour.sheet.uncertainty && <p className="mt-2 text-xs text-muted">{tour.sheet.uncertainty}</p>}
            <h3 className="mt-3 font-semibold">{t("pano.credits")}</h3>
            <ul className="list-disc pl-5">{tour.scenes.map((s) => <li key={s.id}>{s.title}: {s.credit.author}, {s.credit.license}</li>)}</ul>
            <div className="mt-3"><Button type="button" onClick={() => setSheet(false)}>{t("study.verse.close")}</Button></div>
          </div>
        </div>
      )}
      <span className="sr-only" data-testid="pano-state">{scene.id},{Math.round(yawDiff(cam.current.yaw, 0))}</span>
      <span className="sr-only">{defaultBibleVersion()}</span>
    </div>
  );
}
