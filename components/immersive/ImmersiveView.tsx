"use client";

// Immersive engine (spec 8.16, Prompt 3.1, decision D-11: React Three Fiber): first-person walking (touch joystick, keyboard and mouse), collision with
// sliding, points of interest with verses, ambient and spatial sound, zones built as you approach, levels of detail, a guided tour and an automatic
// quality drop when the frame rate falls. Environments are data (lib/immersive/package.ts). Loaded on demand so the 3D engine never weighs on the rest of the app.
import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import type { Group } from "three";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { closeSessionFull, createSession, getBibleVerses, teacherTurn, transcribeAudio } from "@/lib/api-client";
import { defaultBibleVersion, t } from "@/lib/i18n";
import { activeZones, collidersOf, detailFor, keysToStick, move, nearestHotspot, spawnIsFree, worldDirection, yawToward, type V2 } from "@/lib/immersive/movement";
import type { EnvironmentPackage, Hotspot, Station } from "@/lib/immersive/package";
import { formatRefPt } from "@/lib/knowledge/refs-parser";
import { getPlatform } from "@/lib/platform";
import { speakText, stopSpeaking } from "@/lib/voice/client-speak";
import { panelModel } from "@/lib/immersive/vr";
import { Joystick } from "./Joystick";
import { VrLayer, XR, xrStore, type VrInput } from "./VrLayer";
import { TEST_SCENES } from "./scenes-test";

const SCENES: Record<string, (p: { detail: 0 | 1 | 2 }) => React.JSX.Element> = { ...TEST_SCENES };
/** A zone that is a GLB file: downloaded only when the visitor gets near (the zone is mounted by the Rig), released when far. */
function GlbZone({ url, scale, y }: { url: string; scale: number; y: number }) {
  const gltf = useGLTF(url);
  const obj = useMemo(() => gltf.scene.clone(true), [gltf]);
  useEffect(() => () => { useGLTF.clear(url); }, [url]);
  return <primitive object={obj} scale={scale} position={[0, y, 0]} />;
}
const LOOK_SPEED = 0.0035; // radians per pixel

interface Input { keys: Set<string>; stick: V2; lookX: number; lookY: number; teleport: { at: V2; yaw?: number } | null; turn: number }
interface Snapshot { pos: V2; yaw: number; zones: string[]; hotspot: string | null; fps: number }

/** Runs inside the Canvas: moves the camera, loads zones, finds the nearest hotspot, feeds the sound and measures the frame rate. */
function Rig({ pkg, input, pos, origin, onSnapshot, onQuality }: { pkg: EnvironmentPackage; input: React.MutableRefObject<Input>; pos: React.MutableRefObject<V2>; origin: React.RefObject<Group | null>; onSnapshot(s: Snapshot): void; onQuality(): void }) {
  const { camera } = useThree();
  const inXr = useXR((s) => !!s.session);
  const yaw = useRef(pkg.spawnYaw);
  const pitch = useRef(0);
  const zones = useRef<Set<string>>(activeZones(pkg.zones, pkg.spawn as V2, new Set()));
  const acc = useRef({ t: 0, frames: 0, low: 0 });
  const [, setTick] = useState(0);
  const [active, setActive] = useState<Set<string>>(zones.current);
  const ambience = getPlatform().ambience;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const i = input.current;
    if (i.teleport) { pos.current = [...i.teleport.at] as V2; if (i.teleport.yaw !== undefined) yaw.current = i.teleport.yaw; pitch.current = 0; i.teleport = null; }
    if (i.turn) { yaw.current += i.turn; i.turn = 0; }
    yaw.current -= i.lookX * LOOK_SPEED; pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - i.lookY * LOOK_SPEED));
    i.lookX = 0; i.lookY = 0;
    const kb = keysToStick(i.keys);
    const stick: V2 = [Math.max(-1, Math.min(1, kb[0] + i.stick[0])), Math.max(-1, Math.min(1, kb[1] + i.stick[1]))];
    const dir = worldDirection(stick, yaw.current);
    const colliders = collidersOf(pkg.zones, zones.current);
    pos.current = move(pos.current, [dir[0] * pkg.speed * dt, dir[1] * pkg.speed * dt], pkg.radius, colliders, pkg.bounds as { min: V2; max: V2 });
    if (inXr && origin.current) { // in the headset the head belongs to the visitor: we only move the origin (the floor under their feet)
      origin.current.position.set(pos.current[0], 0, pos.current[1]);
      origin.current.rotation.set(0, yaw.current, 0);
    } else {
      camera.position.set(pos.current[0], pkg.eye, pos.current[1]);
      camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    }

    // every 0.2 s: zones, nearest hotspot, sound, frame rate
    const a = acc.current;
    a.t += dt; a.frames++;
    if (a.t >= 0.2) {
      const next = activeZones(pkg.zones, pos.current, zones.current);
      const changed = next.size !== zones.current.size || [...next].some((z) => !zones.current.has(z));
      zones.current = next;
      if (changed) setActive(new Set(next));
      const fps = a.frames / a.t;
      a.low = fps < 28 ? a.low + a.t : Math.max(0, a.low - a.t);
      if (a.low > 3) { a.low = 0; onQuality(); } // 3 seconds under 28 fps: lower the quality
      ambience.setListener([pos.current[0], pkg.eye, pos.current[1]], yaw.current);
      onSnapshot({ pos: [...pos.current] as V2, yaw: yaw.current, zones: [...next], hotspot: nearestHotspot(pkg.hotspots, pos.current, next)?.id ?? null, fps });
      a.t = 0; a.frames = 0;
      setTick((n) => n + 1);
    }
  });

  return (
    <>
      <color attach="background" args={["#bcd9ea"]} />
      <fog attach="fog" args={["#e9d9b4", 30, 80]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[20, 30, 10]} intensity={2} />
      {pkg.zones.filter((z) => active.has(z.id)).map((z) => {
        const d = Math.hypot(pos.current[0] - z.center[0], pos.current[1] - z.center[1]);
        if (z.model) return <Suspense key={z.id} fallback={null}><GlbZone url={z.model.url} scale={z.model.scale} y={z.model.y} /></Suspense>;
        const Scene = SCENES[z.scene];
        if (!Scene) return null;
        return <Scene key={z.id} detail={detailFor(d)} />;
      })}
    </>
  );
}

export default function ImmersiveView({ pkg, onOpenRef, onAuthorPick }: { pkg: EnvironmentPackage; onOpenRef?(ref: string): void; /** Authoring: lets the admin take the visitor's position and where they look, to place a hotspot or a station. */ onAuthorPick?(p: { x: number; z: number; yaw: number }): void }) {
  const input = useRef<Input>({ keys: new Set(), stick: [0, 0], lookX: 0, lookY: 0, teleport: null, turn: 0 });
  const pos = useRef<V2>([...pkg.spawn] as V2);
  const origin = useRef<Group>(null);
  const [vrOk, setVrOk] = useState(false);
  const [inVr, setInVr] = useState(false);
  const [vrClosed, setVrClosed] = useState<string | null>(null);
  const [vrError, setVrError] = useState(false);
  const [vrSheet, setVrSheet] = useState(false);
  const [vrVerses, setVrVerses] = useState<{ ref: string; text: string }[]>([]);
  const [snap, setSnap] = useState<Snapshot>({ pos: pkg.spawn as V2, yaw: pkg.spawnYaw, zones: [], hotspot: null, fps: 0 });
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [open, setOpen] = useState<Hotspot | null>(null);
  const [station, setStation] = useState<number>(-1);
  const [dpr, setDpr] = useState<number>(1.5);
  const [sheet, setSheet] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  // the teacher as guide (Prompt 3.3): free questions answered in the context of the place
  const sessionId = useRef<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ who: "me" | "teacher"; text: string; options?: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const projection = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("p") === "1"; // for a teacher projecting the tour in a classroom
  const snapRef = useRef(snap);
  const touch = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches, []);
  const showFps = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fps") === "1";
  const ambience = getPlatform().ambience;

  const start = useCallback(async () => {
    setStarted(true);
    getPlatform().speech.unlock();
    const layers = pkg.sounds.map((s) => ({ id: s.id, kind: s.kind, layer: s.layer, volume: s.volume, at: s.kind === "spatial" ? s.at : undefined, radius: s.kind === "spatial" ? s.radius : undefined }));
    await ambience.start(layers).catch(() => undefined);
  }, [pkg, ambience]);
  useEffect(() => () => { ambience.stop(); stopSpeaking(); }, [ambience]);
  useEffect(() => { ambience.setMuted(muted); }, [muted, ambience]);

  // keyboard
  useEffect(() => {
    if (!started) return;
    const k = input.current.keys;
    const down = (e: KeyboardEvent) => { const key = e.key.toLowerCase(); if (projection && (key === "arrowright" || key === "arrowleft")) { goToRef.current?.(Math.max(0, Math.min(pkg.stations.length - 1, stationRef.current + (key === "arrowright" ? 1 : -1)))); e.preventDefault(); return; } if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) { k.add(key); e.preventDefault(); } if (key === "e" || key === "enter") setOpen((cur) => cur ?? (snapHotspot.current ? pkg.hotspots.find((h) => h.id === snapHotspot.current) ?? null : null)); if (key === "escape") setOpen(null); };
    const up = (e: KeyboardEvent) => k.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); k.clear(); };
  }, [started, pkg, projection]);
  snapRef.current = snap;
  const stationRef = useRef(station);
  stationRef.current = station;
  const snapHotspot = useRef<string | null>(null);
  snapHotspot.current = snap.hotspot;

  // looking: mouse (pointer lock on click, or drag) and touch (drag on the right half)
  const lastLook = useRef<{ id: number; x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && e.clientX < (wrap.current?.getBoundingClientRect().left ?? 0) + (wrap.current?.clientWidth ?? 0) * 0.4) return; // left side belongs to the joystick
    lastLook.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (document.pointerLockElement) { input.current.lookX += e.movementX; input.current.lookY += e.movementY; return; }
    const l = lastLook.current;
    if (!l || l.id !== e.pointerId) return;
    input.current.lookX += e.clientX - l.x; input.current.lookY += e.clientY - l.y;
    l.x = e.clientX; l.y = e.clientY;
  };
  const onPointerUp = () => { lastLook.current = null; };

  const goToRef = useRef<((i: number) => void) | null>(null);
  function goTo(i: number) {
    const s: Station | undefined = pkg.stations[i];
    if (!s) return;
    stopSpeaking(); setSpeaking(false);
    setStation(i);
    input.current.teleport = { at: s.at as V2, yaw: yawToward(s.at as V2, s.look as V2) };
  }
  goToRef.current = goTo;
  async function sendQuestion(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setBusy(true); setGuideError(null); setQuestion("");
    setThread((t) => [...t, { who: "me", text }]);
    try {
      if (!sessionId.current) sessionId.current = (await createSession("free")).sessionId;
      const s = snapRef.current;
      const { response } = await teacherTurn({ sessionId: sessionId.current, text, scene: { env: pkg.id, x: s.pos[0], z: s.pos[1], yaw: s.yaw, hotspot: s.hotspot, station: stationRef.current >= 0 ? stationRef.current : null } });
      setThread((t) => [...t, { who: "teacher", text: response.display_markdown || response.speech, options: response.next_options.map((o) => o.label).slice(0, 3) }]);
      void say(response.speech);
    } catch { setGuideError(t("imm.ask.error")); }
    setBusy(false);
  }
  async function toggleMic() {
    const mic = getPlatform().microphone;
    if (!recording) { try { await mic.start(); setRecording(true); } catch { setGuideError(t("study.error.mic")); } return; }
    setRecording(false);
    try { const blob = await mic.stop(); const r = await transcribeAudio(blob); if (r.text.trim()) await sendQuestion(r.text); else setGuideError(t("study.error.heard")); } catch { setGuideError(t("study.error.heard")); }
  }
  async function finish() {
    stopSpeaking();
    const id = sessionId.current;
    if (id) { try { await closeSessionFull(id); } catch { /* the closing screen retries */ } router.push(`/fechamento?s=${id}`); }
    else router.back();
  }
  async function say(text: string) { setSpeaking(true); try { await speakText(text); } finally { setSpeaking(false); } }

  const hot = snap.hotspot ? pkg.hotspots.find((h) => h.id === snap.hotspot) ?? null : null;
  const st = station >= 0 ? pkg.stations[station] : null;
  const blocked = !spawnIsFree(pkg);

  // virtual reality (Prompt 3.5): the button only appears where the browser says it can do immersive-vr (Quest Browser, Safari on Vision Pro)
  useEffect(() => {
    let alive = true;
    void navigator.xr?.isSessionSupported?.("immersive-vr").then((ok) => { if (alive) setVrOk(!!ok); }).catch(() => undefined);
    const off = xrStore?.subscribe((st) => setInVr(!!st.session));
    return () => { alive = false; off?.(); };
  }, []);
  async function enterVr() { setVrError(false); try { await start(); await xrStore?.enterVR(); } catch { setVrError(true); } }
  const vrHot = inVr && hot && hot.id !== vrClosed ? hot : null;
  useEffect(() => {
    if (!vrHot) { setVrVerses([]); return; }
    let alive = true;
    void Promise.all(vrHot.refs.slice(0, 2).map((r) => getBibleVerses(defaultBibleVersion(), r).then((v) => v.verses.slice(0, 2)).catch(() => []))).then((all) => { if (alive) setVrVerses(all.flat()); });
    return () => { alive = false; };
  }, [vrHot]);
  const lastAnswer = [...thread].reverse().find((m) => m.who === "teacher");
  const labels = { ask: t("imm.ask"), stop: t("study.mic.stop"), thinking: t("study.status.thinking"), close: t("study.verse.close"), prev: t("imm.prev"), next: t("imm.next"), start: t("imm.tour.start"), listen: t("imm.listen"), sheet: t("imm.sheet") };
  const panel = vrSheet
    ? { title: t("imm.sheet"), body: `${pkg.sheet.summary} ${t("imm.sources")}: ${pkg.sheet.sources.join("; ")}`, verses: [], buttons: [{ id: "close" as const, label: labels.close }] }
    : panelModel({ hotspot: vrHot ? { label: vrHot.label, text: vrHot.text, verses: vrVerses } : null, answer: lastAnswer && station < 0 ? { text: lastAnswer.text } : null, station: st ? { title: st.title, script: st.script, index: station, total: pkg.stations.length } : null, recording, busy, hasTour: pkg.stations.length > 0 }, labels);
  function onVrButton(id: string) {
    if (id === "close") { if (vrSheet) setVrSheet(false); else if (vrHot) setVrClosed(vrHot.id); }
    else if (id === "next") goTo(Math.min(pkg.stations.length - 1, station + 1));
    else if (id === "prev") goTo(Math.max(0, station - 1));
    else if (id === "listen") void say(st ? st.script : lastAnswer?.text ?? "");
    else if (id === "ask") void toggleMic();
    else if (id === "sheet") setVrSheet(true);
  }

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden bg-[#f1dfb9]" data-testid="immersive" role="application" aria-label={`${pkg.title}. ${t("imm.keys")}`}>
      <div className="absolute inset-0 touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onClick={(e) => { if (!touch && started && e.target instanceof HTMLCanvasElement) void e.target.requestPointerLock?.(); }}>
        <Canvas dpr={[1, dpr]} camera={{ fov: 70, near: 0.1, far: 120, position: [pkg.spawn[0], pkg.eye, pkg.spawn[1]] }} gl={{ antialias: dpr > 1.2, powerPreference: "high-performance" }} aria-hidden>
          {xrStore ? (
            <XR store={xrStore}>
              <Rig pkg={pkg} input={input} pos={pos} origin={origin} onSnapshot={setSnap} onQuality={() => setDpr((d) => (d > 1 ? 1 : d))} />
              <VrLayer pkg={pkg} origin={origin} pos={pos} input={input as React.MutableRefObject<VrInput>} model={panel} onButton={onVrButton} />
            </XR>
          ) : null}
        </Canvas>
      </div>

      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 p-6 text-center text-white">
          <h2 className="text-2xl">{pkg.title}</h2>
          <p className="max-w-sm text-sm">{pkg.era}</p>
          <p className="max-w-sm text-xs opacity-90">{touch ? t("imm.help.touch") : t("imm.help.desktop")}</p>
          <Button type="button" onClick={() => void start()} disabled={blocked}>{t("imm.enter")}</Button>
        </div>
      )}

      {started && (
        <>
          <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
            <div className="pointer-events-auto rounded-control bg-black/45 px-3 py-1 text-sm text-white">{pkg.title}</div>
            <div className="pointer-events-auto flex gap-2">
              {vrOk && <button type="button" data-testid="imm-vr" onClick={() => void enterVr()} className="min-h-9 rounded-control bg-black/45 px-3 text-sm text-white">{t("imm.vr")}</button>}
              {!projection && <button type="button" data-testid="imm-ask" onClick={() => setAsk((a) => !a)} className="min-h-9 rounded-control bg-primary px-3 text-sm font-semibold text-primary-ink">{t("imm.ask")}</button>}
              <button type="button" onClick={() => setSheet(true)} className="min-h-9 rounded-control bg-black/45 px-3 text-sm text-white">{t("imm.sheet")}</button>
              <button type="button" data-testid="imm-finish" onClick={() => void finish()} className="min-h-9 rounded-control bg-black/45 px-3 text-sm text-white">{t("imm.finish")}</button>
              <button type="button" aria-pressed={muted} onClick={() => setMuted((m) => !m)} className="min-h-9 rounded-control bg-black/45 px-3 text-sm text-white">{muted ? t("imm.unmute") : t("imm.mute")}</button>
            </div>
          </div>
          {onAuthorPick && <button type="button" data-testid="imm-pick" onClick={() => onAuthorPick({ x: +snap.pos[0].toFixed(2), z: +snap.pos[1].toFixed(2), yaw: +snap.yaw.toFixed(3) })} className="absolute right-2 top-14 min-h-9 rounded-control bg-primary px-3 text-sm font-semibold text-primary-ink">{t("env.pick")}</button>}
          <p className="pointer-events-none absolute left-2 top-12 max-w-[70%] text-[10px] leading-tight text-white/85 [text-shadow:0_1px_2px_#000]" data-testid="imm-caption">{t("imm.caption")}</p>
          {vrError && <p role="alert" className="absolute left-2 right-2 top-24 rounded-control bg-black/70 p-2 text-sm text-white">{t("imm.vr.error")}</p>}
          {showFps && <div className="absolute left-2 top-12 rounded bg-black/55 px-2 text-xs text-white" data-testid="imm-fps">{Math.round(snap.fps)} fps · dpr {dpr}</div>}
          <span className="sr-only" data-testid="imm-pos" aria-live="off">{snap.pos[0].toFixed(2)},{snap.pos[1].toFixed(2)},{snap.yaw.toFixed(2)},{snap.zones.join("+")}</span>

          {hot && !open && (
            <button type="button" data-testid="imm-hotspot" onClick={() => setOpen(hot)} className="absolute bottom-40 left-1/2 min-h-11 -translate-x-1/2 rounded-control bg-primary px-4 font-semibold text-primary-ink shadow">{t("imm.see").replace("{label}", hot.label)}</button>
          )}

          {st && (
            <div className={`absolute left-2 right-2 top-14 rounded-control bg-black/60 p-3 text-white ${projection ? "text-2xl leading-snug" : "text-sm"}`} data-testid="imm-station">
              <strong>{st.title}</strong>
              <p className="mt-1">{st.script}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="min-h-9 rounded-control bg-white/20 px-3" disabled={speaking} onClick={() => void say(st.script)}>{speaking ? "…" : t("imm.listen")}</button>
                {st.refs.slice(0, 3).map((r) => <button key={r} type="button" className="min-h-9 rounded-control bg-white/20 px-3 underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}
              </div>
            </div>
          )}

          {!!pkg.stations.length && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2" role="group" aria-label={t("imm.tour")}>
              <button type="button" className="min-h-10 rounded-control bg-black/55 px-3 text-sm text-white disabled:opacity-40" disabled={station <= 0} onClick={() => goTo(station - 1)}>{t("imm.prev")}</button>
              <button type="button" data-testid="imm-next" className="min-h-10 rounded-control bg-primary px-3 text-sm font-semibold text-primary-ink disabled:opacity-40" disabled={station >= pkg.stations.length - 1} onClick={() => goTo(station + 1)}>{station < 0 ? t("imm.tour.start") : t("imm.next")}</button>
            </div>
          )}

          {ask && !projection && (
            <div className="absolute inset-x-2 bottom-14 flex max-h-[55%] flex-col gap-2 rounded-control border border-line bg-surface p-3 text-sm shadow-lg" role="dialog" aria-label={t("imm.ask")} data-testid="imm-chat">
              <div className="flex-1 overflow-auto" aria-live="polite">
                {!thread.length && <p className="text-muted">{t("imm.ask.hint")}</p>}
                {thread.map((m, i) => (
                  <div key={i} className="mb-2">
                    <strong>{m.who === "me" ? t("study.you") : t("study.teacher")}</strong>
                    <p className="whitespace-pre-line" data-testid={m.who === "teacher" ? "imm-answer" : undefined}>{m.text}</p>
                    {m.who === "teacher" && i === thread.length - 1 && !!m.options?.length && <div className="mt-1 flex flex-wrap gap-1">{m.options.map((o) => <button key={o} type="button" className="min-h-8 rounded-control border border-line px-2 text-xs" onClick={() => void sendQuestion(o)}>{o}</button>)}</div>}
                  </div>
                ))}
                {busy && <p role="status" className="text-muted">{t("study.status.thinking")}</p>}
                {guideError && <p role="alert">{guideError}</p>}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void sendQuestion(question); }}>
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("study.placeholder")} aria-label={t("study.placeholder")} className="min-h-10 flex-1 rounded-control border border-line bg-bg px-3" />
                <button type="button" aria-pressed={recording} aria-label={recording ? t("study.mic.stop") : t("study.mic.start")} onClick={() => void toggleMic()} className="min-h-10 rounded-control border border-line px-3">{recording ? "■" : "🎤"}</button>
                <button type="submit" disabled={busy} className="min-h-10 rounded-control bg-primary px-3 font-semibold text-primary-ink">{t("study.send")}</button>
              </form>
            </div>
          )}
          {touch && <div className="absolute bottom-6 left-4"><Joystick label={t("imm.joystick")} onChange={(v) => { input.current.stick = v; }} /></div>}
        </>
      )}

      {open && (
        <div className="absolute inset-x-2 bottom-2 rounded-control border border-line bg-surface p-3 text-sm shadow-lg" role="dialog" aria-label={open.label} data-testid="imm-panel">
          <strong>{open.label}</strong>{open.basis && <span className="ml-2 rounded bg-black/10 px-2 py-0.5 text-xs" data-testid="imm-basis">{t(`imm.basis.${open.basis}` as "imm.basis.escritura")}</span>}
          <p className="mt-1">{open.text}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {open.refs.slice(0, 3).map((r) => <button key={r} type="button" className="min-h-9 rounded-control border border-line px-3 underline" onClick={() => onOpenRef?.(r.split("-")[0])}>{formatRefPt(r)}</button>)}
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{t("study.verse.close")}</Button>
          </div>
        </div>
      )}

      {sheet && (
        <div className="absolute inset-0 overflow-auto bg-black/60 p-4" role="dialog" aria-label={t("imm.sheet")} data-testid="imm-sheet">
          <div className="mx-auto max-w-md rounded-control bg-surface p-4 text-sm">
            <h2 className="text-lg">{t("imm.sheet")}</h2>
            <p className="mt-1">{pkg.sheet.summary}</p>
            <h3 className="mt-3 font-semibold">{t("imm.sources")}</h3>
            <ul className="list-disc pl-5">{pkg.sheet.sources.map((s) => <li key={s}>{s}</li>)}</ul>
            {pkg.sheet.uncertainty && <p className="mt-2 text-xs text-muted">{pkg.sheet.uncertainty}</p>}
            <div className="mt-3"><Button type="button" onClick={() => setSheet(false)}>{t("study.verse.close")}</Button></div>
          </div>
        </div>
      )}
      <span className="sr-only">{defaultBibleVersion()}</span>
    </div>
  );
}
