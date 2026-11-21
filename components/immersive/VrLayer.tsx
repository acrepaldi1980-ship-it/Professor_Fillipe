"use client";

// Everything that only exists inside a headset (Prompt 3.5): the visitor's origin, snap turning, teleport and the floating panel with the
// teacher. Comfort rules live in lib/immersive/vr.ts. Loaded only when the browser reports immersive-vr support.
import { TeleportTarget, XR, XROrigin, createXRStore, useXR, useXRInputSourceState } from "@react-three/xr";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, DoubleSide, type Group, type Mesh, Vector3 } from "three";
import { fitFont, wrapLines } from "@/lib/share/card";
import { COMFORT, type PanelModel, panelPose, snapTurn, teleportTarget } from "@/lib/immersive/vr";
import { collidersOf, type V2 } from "@/lib/immersive/movement";
import type { EnvironmentPackage } from "@/lib/immersive/package";

export const xrStore = typeof window === "undefined" ? null : createXRStore({ foveation: 1, frameRate: "high", emulate: false });

export interface VrInput { turn: number; teleport: { at: V2; yaw?: number } | null }

const W = 1280, H = 800, METERS_W = 1.7;
const BG = "#faf3e3", INK = "#2e2a24", PRIMARY = "#b4532a", MUTED = "#6b645a";

/** Where each button sits on the panel texture, shared by the drawing and by the pointer. */
export function buttonRects(n: number): { x: number; y: number; w: number; h: number }[] {
  const gap = 20, w = Math.min(360, (W - 80 - gap * (n - 1)) / Math.max(n, 1)), total = w * n + gap * (n - 1);
  return Array.from({ length: n }, (_, i) => ({ x: (W - total) / 2 + i * (w + gap), y: H - 150, w, h: 110 }));
}

function drawPanel(ctx: CanvasRenderingContext2D, m: PanelModel) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = PRIMARY; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
  const measure = (size: number, s: string) => { ctx.font = `${size}px sans-serif`; return ctx.measureText(s).width; };
  let y = 40;
  if (m.title) { ctx.fillStyle = PRIMARY; ctx.font = "bold 54px sans-serif"; ctx.textBaseline = "top"; ctx.fillText(m.title, 50, y); y += 76; }
  const versesText = m.verses.map((v) => `${v.ref}: ${v.text}`).join(" ");
  const bodyH = H - 170 - y - (versesText ? 230 : 0);
  const body = fitFont(m.body, W - 100, bodyH, measure, 52, 34);
  ctx.fillStyle = INK; ctx.font = `${body.size}px sans-serif`; ctx.textBaseline = "top";
  body.lines.forEach((l, i) => ctx.fillText(l, 50, y + i * body.size * 1.35));
  if (versesText) {
    const vy = H - 170 - 220;
    ctx.fillStyle = MUTED; ctx.font = "italic 34px sans-serif";
    wrapLines(versesText, W - 100, (s) => ctx.measureText(s).width).slice(0, 5).forEach((l, i) => ctx.fillText(l, 50, vy + i * 44));
  }
  const rects = buttonRects(m.buttons.length);
  m.buttons.forEach((b, i) => {
    const r = rects[i];
    ctx.fillStyle = PRIMARY; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 24); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 44px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillText(b.label, r.x + r.w / 2, r.y + r.h / 2); ctx.textAlign = "left";
  });
}

/** The panel floating in front of the visitor, redrawn when the model changes and re-placed when its content changes. Buttons answer to the controller ray, to a pinch or to the gaze-pinch of the Vision Pro. */
function Panel({ model, onButton }: { model: PanelModel; onButton(id: PanelModel["buttons"][number]["id"]): void }) {
  const ref = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);
  const canvas = useMemo(() => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; }, []);
  const texture = useMemo(() => new CanvasTexture(canvas), [canvas]);
  const key = `${model.title}|${model.body}|${model.verses.length}`;
  useEffect(() => { const ctx = canvas.getContext("2d"); if (ctx) { drawPanel(ctx, model); texture.needsUpdate = true; } }, [model, canvas, texture]);
  useEffect(() => {
    // place it ahead of where the visitor is looking, once per new content (it does not chase the head: that would make people dizzy)
    const head = camera.getWorldPosition(new Vector3());
    const dir = camera.getWorldDirection(new Vector3());
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pose = panelPose([head.x, head.y, head.z], yaw);
    ref.current?.position.set(...pose.position);
    ref.current?.rotation.set(0, pose.yaw, 0);
  }, [key, camera]);
  const empty = !model.title && !model.body && !model.buttons.length;
  return (
    <mesh ref={ref} visible={!empty} onClick={(e) => {
      if (!e.uv) return;
      const px = e.uv.x * W, py = (1 - e.uv.y) * H;
      const i = buttonRects(model.buttons.length).findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
      if (i >= 0) { e.stopPropagation(); onButton(model.buttons[i].id); }
    }}>
      <planeGeometry args={[METERS_W, (METERS_W * H) / W]} />
      <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/** Reads the right thumbstick for snap turning: one flick = 30°. No smooth turning and no smooth walking, on purpose. */
function SnapTurning({ input }: { input: React.MutableRefObject<VrInput> }) {
  const right = useXRInputSourceState("controller", "right");
  const st = useRef({ armed: true });
  useFrame(() => {
    const x = right?.gamepad?.["xr-standard-thumbstick"]?.xAxis ?? 0;
    const r = snapTurn(st.current, x);
    st.current = r.state;
    if (r.yawDelta) input.current.turn += r.yawDelta;
  });
  return null;
}

export function VrLayer({ pkg, origin, pos, input, model, onButton }: { pkg: EnvironmentPackage; origin: React.RefObject<Group | null>; pos: React.MutableRefObject<V2>; input: React.MutableRefObject<VrInput>; model: PanelModel; onButton(id: PanelModel["buttons"][number]["id"]): void }) {
  const inSession = useXR((s) => !!s.session);
  const zonesAll = useMemo(() => collidersOf(pkg.zones, new Set(pkg.zones.map((z) => z.id))), [pkg]);
  return (
    <>
      <XROrigin ref={origin} />
      {inSession && (
        <>
          <SnapTurning input={input} />
          <TeleportTarget onTeleport={(p) => {
            const to = teleportTarget(pkg, zonesAll, pos.current, [p.x, p.z]);
            if (to) input.current.teleport = { at: to };
          }}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} visible={false}>
              <planeGeometry args={[400, 400]} />
              <meshBasicMaterial />
            </mesh>
          </TeleportTarget>
          <Panel model={model} onButton={onButton} />
        </>
      )}
    </>
  );
}
export { XR, COMFORT };
