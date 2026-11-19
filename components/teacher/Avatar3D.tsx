"use client";

// Professor Filipe — semi-realistic full-body 3D human (D-18). The body is generated from the CC0 MakeHuman/MPFB2 data
// (see docs/PERSONAGEM_FILIPE.md) and dressed as an original 1st-century scholar: linen tunic, indigo mantle, head
// wrap, grey beard, scroll. It is NOT a depiction of any biblical person (RA-23). Poses are applied on the skeleton in
// world axes (so a gesture means the same thing whatever the bone orientation is), the face uses morph targets
// (jaw, smile, blink, brows) and the mouth follows the speech level (RF-M17-02). "Reduce motion" keeps expressions only.
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AvatarState } from "./Avatar";
import { Avatar } from "./Avatar";

export const FILIPE_MODEL = "/models/filipe.glb";

type V3 = [number, number, number];
type Pose = Record<string, V3>;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ---- procedural textures (no image files, nothing to license) ----
function noiseTexture(base: string, dark: string, light: string, streaks: boolean, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const n = streaks ? 1800 : 2500;
  for (let i = 0; i < n; i++) {
    g.strokeStyle = Math.random() < 0.5 ? dark : light;
    g.globalAlpha = 0.18 + Math.random() * 0.3;
    g.lineWidth = streaks ? 1 + Math.random() : 1.5;
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (streaks ? (Math.random() - 0.5) * 6 : Math.random() * 2), y + (streaks ? 8 + Math.random() * 16 : Math.random() * 2));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function materialFor(name: string): THREE.Material | null {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  switch (name) {
    case "Body": {
      const bump = noiseTexture("#808080", "#606060", "#a0a0a0", false);
      bump.repeat.set(10, 10);
      return new THREE.MeshStandardMaterial({ color: "#c08660", roughness: 0.58, vertexColors: true, bumpMap: bump, bumpScale: 0.35 });
    }
    case "Tunic":
    case "Skirt": {
      const t = noiseTexture("#eadcbd", "#cdbb92", "#f4e9cf", false);
      t.repeat.set(8, 8);
      return std({ map: t, roughness: 0.95 });
    }
    case "Sash": return std({ color: "#8a5a2b", roughness: 0.8 });
    case "Mantle": {
      const t = noiseTexture("#2f4a6b", "#233a57", "#3a5a80", false);
      t.repeat.set(8, 8);
      return std({ map: t, roughness: 0.92 });
    }
    case "HeadWrap": return std({ color: "#f1e8d3", roughness: 0.95 });
    case "HeadBand": return std({ color: "#7a4a2a", roughness: 0.85 });
    case "Hair": return std({ color: "#9a928a", roughness: 1 });
    case "Brows": return std({ color: "#8a837a", roughness: 1 });
    case "Beard": {
      const t = noiseTexture("#aaa49b", "#807a72", "#d4cfc6", true);
      t.repeat.set(6, 6);
      return std({ map: t, roughness: 1 });
    }
    case "EyeL":
    case "EyeR": return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12 });
    default: return null;
  }
}

// Gestures are expressed as (forward raise, spread away from the body, elbow bend) per arm.
type Arm = { fwd: number; spread: number; elbow: number; hand?: number };
function armPose(s: 1 | -1, a: Arm, curl: number): Pose {
  const side = s === 1 ? "l" : "r";
  const DOWN = 0.8; // the model rests in an A-pose; this brings the arm down to the side
  return {
    ["upperarm_" + side]: [-a.fwd, 0, -s * (DOWN - a.spread)],
    ["lowerarm_" + side]: [-a.elbow, 0, 0],
    ["hand_" + side]: [-(a.hand ?? 0), 0, 0],
    ...Object.fromEntries(
      ["index", "middle", "ring", "pinky"].flatMap((f) => [1, 2, 3].map((i) => [`${f}_0${i}_${side}`, [-curl * (i === 1 ? 0.8 : 1), 0, 0] as V3])),
    ),
    ["thumb_01_" + side]: [0, 0, s * curl * 0.3],
  };
}

const REST_ARM: Arm = { fwd: 0.04, spread: 0.03, elbow: 0.28 };

function poseFor(state: AvatarState): { pose: Pose; brows: number; worry: number; smile: number } {
  let R: Arm = REST_ARM;
  let L: Arm = REST_ARM;
  const p: Pose = { head: [0, 0, 0], neck_01: [0, 0, 0], spine_02: [0, 0, 0] };
  let brows = 0;
  let worry = 0;
  let smile = 0.12;
  switch (state) {
    case "listening":
      p.head = [0.05, 0, 0.1]; p.spine_02 = [0.04, 0, 0]; brows = 0.45; smile = 0.2; break;
    case "thinking":
      R = { fwd: 0.6, spread: -0.2, elbow: 2.1, hand: 0.1 }; L = { fwd: 0.25, spread: -0.25, elbow: 1.35 };
      p.head = [-0.05, 0.25, 0.07]; brows = 0.5; smile = 0; break;
    case "happy":
      R = { fwd: 0.35, spread: 0.5, elbow: 1.0 }; L = { fwd: 0.35, spread: 0.5, elbow: 1.0 };
      p.head = [-0.06, 0, 0]; smile = 1; brows = 0.3; break;
    case "empathetic":
      R = { fwd: 0.3, spread: -0.25, elbow: 1.4 }; L = { fwd: 0.3, spread: -0.25, elbow: 1.4 };
      p.head = [0.07, 0, -0.1]; worry = 0.9; smile = 0.05; break;
    case "pointing":
      L = { fwd: 0.95, spread: 0.12, elbow: 0.3 }; p.head = [0, -0.25, 0]; smile = 0.45; break;
    default: break;
  }
  Object.assign(p, armPose(-1, R, state === "pointing" ? 0.5 : 0.35), armPose(1, L, state === "pointing" ? 0.55 : 0.35));
  if (state === "pointing") for (const i of [1, 2, 3]) p[`index_0${i}_l`] = [0, 0, 0];
  return { pose: p, brows, worry, smile };
}

const POSED = [
  "spine_01", "spine_02", "spine_03", "neck_01", "head",
  ...["l", "r"].flatMap((s) => [
    `clavicle_${s}`, `upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`,
    ...["index", "middle", "ring", "pinky"].flatMap((f) => [1, 2, 3].map((i) => `${f}_0${i}_${s}`)),
    "thumb_01_" + s, "thumb_02_" + s, "thumb_03_" + s,
  ]),
];

type RestInfo = { bone: THREE.Object3D; parent: string | null; W0: THREE.Quaternion; Wp0: THREE.Quaternion };

function Filipe({ state, level, reduceMotion }: { state: AvatarState; level: number; reduceMotion: boolean }) {
  const { scene } = useGLTF(FILIPE_MODEL);
  const root = useMemo(() => cloneSkinned(scene), [scene]);
  const rest = useRef<Record<string, RestInfo>>({});
  const morphMeshes = useRef<THREE.Mesh[]>([]);
  const cur = useRef<Record<string, V3>>({});
  const g = useRef({ next: 1.2, start: 0, dur: 1, kind: "none" as "none" | "beatR" | "beatL" | "open" });
  const blink = useRef({ next: 2.5, t: -1 });
  const mouth = useRef(0);
  const smile = useRef(0.1);
  const brow = useRef({ up: 0, worry: 0 });
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  stateRef.current = state;
  levelRef.current = level;

  useEffect(() => {
    const bones: Record<string, THREE.Object3D> = {};
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = materialFor(m.name);
        if (mat) m.material = mat;
        m.castShadow = true;
        m.frustumCulled = false;
        if (m.morphTargetDictionary) meshes.push(m);
      }
    });
    morphMeshes.current = meshes;
    root.updateMatrixWorld(true);
    const info: Record<string, RestInfo> = {};
    for (const name of POSED) {
      const b = bones[name];
      if (!b) continue;
      const W0 = b.getWorldQuaternion(new THREE.Quaternion());
      const Wp0 = (b.parent ?? b).getWorldQuaternion(new THREE.Quaternion());
      info[name] = { bone: b, parent: b.parent && POSED.includes(b.parent.name) ? b.parent.name : null, W0, Wp0 };
    }
    rest.current = info;
    // the scroll the teacher carries in his right hand
    const hand = bones["hand_r"];
    if (hand) {
      const scroll = new THREE.Group();
      scroll.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.17, 16), new THREE.MeshStandardMaterial({ color: "#e9d9ae", roughness: 0.9 })));
      for (const e of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 12), new THREE.MeshStandardMaterial({ color: "#7a4a2a", roughness: 0.7 }));
        cap.position.y = e * 0.09;
        scroll.add(cap);
      }
      scroll.rotation.set(0, 0, Math.PI / 2);
      scroll.position.set(0, 0.03, 0.025);
      hand.add(scroll);
    }
  }, [root]);

  const setMorph = (name: string, v: number) => {
    for (const m of morphMeshes.current) {
      const i = m.morphTargetDictionary?.[name];
      if (i !== undefined && m.morphTargetInfluences) m.morphTargetInfluences[i] = v;
    }
  };

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const st = stateRef.current;
    const motion = reduceMotion ? 0 : 1;
    const k = 1 - Math.exp(-dt * 7);
    const { pose, brows, worry, smile: smileT } = poseFor(st);
    const speaking = st === "speaking";
    const lv = clamp(levelRef.current * 3.2);

    // speaking gestures: beats with either hand, or both hands open
    const gs = g.current;
    if (speaking && motion && t > gs.next) {
      const r = Math.random();
      gs.kind = r < 0.4 ? "beatR" : r < 0.75 ? "beatL" : "open";
      gs.start = t;
      gs.dur = 0.8 + Math.random() * 0.6;
      gs.next = t + gs.dur + 0.5 + Math.random() * 1.1;
    }
    const gp = speaking && motion && t < gs.start + gs.dur ? Math.sin((Math.PI * (t - gs.start)) / gs.dur) : 0;
    if (gp > 0) {
      const amp = 0.6 + 0.4 * clamp(levelRef.current * 3);
      const beat: Arm = { fwd: 0.35 + 0.55 * gp * amp, spread: 0.12 + 0.2 * gp, elbow: 0.28 + 0.95 * gp * amp };
      if (gs.kind === "beatR" || gs.kind === "open") Object.assign(pose, armPose(-1, beat, 0.3));
      if (gs.kind === "beatL" || gs.kind === "open") Object.assign(pose, armPose(1, beat, 0.3));
    }
    // breathing, sway, talking head motion
    const breathe = Math.sin(t * 1.7) * 0.012 * motion;
    pose.spine_01 = [breathe, Math.sin(t * 0.4) * 0.03 * motion, Math.sin(t * 0.5) * 0.015 * motion];
    pose.spine_03 = [breathe * 0.8, 0, 0];
    const h = pose.head;
    if (speaking) pose.head = [h[0] + Math.sin(t * 5.3) * 0.03 * lv * motion, h[1] + Math.sin(t * 1.3) * 0.08 * motion, h[2]];
    else if (st === "idle") pose.head = [h[0], Math.sin(t * 0.6) * 0.1 * motion, h[2]];
    else if (st === "listening") pose.head = [h[0] + Math.max(0, Math.sin(t * 1.9)) * 0.06 * motion, h[1], h[2]];

    // apply: world-axis rotations, parents first (see header)
    const tot: Record<string, THREE.Quaternion> = {};
    const eul = new THREE.Euler(0, 0, 0, "XYZ");
    const id = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    for (const name of POSED) {
      const info = rest.current[name];
      if (!info) continue;
      const c = (cur.current[name] ??= [0, 0, 0]);
      const target = pose[name] ?? [0, 0, 0];
      for (let i = 0; i < 3; i++) c[i] = lerp(c[i], target[i], k);
      const prel = new THREE.Quaternion().setFromEuler(eul.set(c[0], c[1], c[2], "XYZ"));
      const ptotParent = (info.parent && tot[info.parent]) || id;
      const ptot = prel.clone().multiply(ptotParent);
      tot[name] = ptot;
      const wpPosed = ptotParent.clone().multiply(info.Wp0);
      q.copy(wpPosed).invert().multiply(ptot).multiply(info.W0);
      info.bone.quaternion.copy(q);
    }

    // face: jaw from the speech level, smile, blink, brows
    const wantOpen = speaking ? (reduceMotion ? 0.25 : lv) : 0;
    mouth.current = lerp(mouth.current, wantOpen, 1 - Math.exp(-dt * 22));
    smile.current = lerp(smile.current, smileT, k);
    brow.current.up = lerp(brow.current.up, brows, k);
    brow.current.worry = lerp(brow.current.worry, worry, k);
    const b = blink.current;
    if (t > b.next && b.t < 0) b.t = 0;
    let blinkAmt = 0;
    if (b.t >= 0 && motion) {
      b.t += dt;
      blinkAmt = Math.sin(Math.min(1, b.t / 0.18) * Math.PI);
      if (b.t > 0.18) {
        b.t = -1;
        b.next = t + 2.5 + Math.random() * 3;
      }
    }
    const happy = st === "happy";
    setMorph("jawOpen", clamp(mouth.current * 0.7));
    setMorph("smile", clamp(smile.current * (1 - 0.6 * mouth.current)));
    setMorph("blink", happy ? 0.7 : blinkAmt);
    setMorph("browsUp", brow.current.up);
    setMorph("browsWorry", brow.current.worry);
    setMorph("browsDown", 0);
    root.position.y = happy ? Math.abs(Math.sin(t * 5)) * 0.04 * motion : 0;
  });

  return <primitive object={root} />;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useWebGL() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

function useReduceMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

/** Camera framing: whole body, or head and shoulders for the compact mode. */
function Rig({ mode }: { mode: "full" | "bust" }) {
  useFrame(({ camera }, dt) => {
    const k = 1 - Math.exp(-dt * 4);
    const y = mode === "full" ? 0.98 : 1.6;
    const z = mode === "full" ? 4.3 : 1.45;
    camera.position.y = lerp(camera.position.y, y, k);
    camera.position.z = lerp(camera.position.z, z, k);
    camera.lookAt(0, mode === "full" ? 0.9 : 1.56, 0);
  });
  return null;
}

export function Avatar3D({ state, level = 0, mode = "full", className }: { state: AvatarState; level?: number; mode?: "full" | "bust"; className?: string }) {
  const webgl = useWebGL();
  const reduce = useReduceMotion();
  const light = useMemo(() => new THREE.Color("#fff3df"), []);
  const fallback = <Avatar state={state} level={level} size={112} />;
  if (webgl === false) return fallback;
  if (webgl === null) return <div className={className} aria-hidden="true" />;
  return (
    <ModelBoundary fallback={fallback}>
      <div className={className} aria-hidden="true" style={{ width: "100%", height: "100%", minHeight: 120 }}>
        <Canvas dpr={[1, 2]} shadows camera={{ position: [0, 1.05, 4.3], fov: 30 }} gl={{ antialias: true, alpha: true }}>
          <hemisphereLight args={[light, "#8a6a4a", 1.0]} />
          <directionalLight position={[2.5, 4, 3.5]} intensity={2.0} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-3, 1.5, 2]} intensity={0.7} color="#ffd9b8" />
          <Rig mode={mode} />
          <Suspense fallback={null}>
            <Filipe state={state} level={level} reduceMotion={reduce} />
          </Suspense>
          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
        </Canvas>
      </div>
    </ModelBoundary>
  );
}
