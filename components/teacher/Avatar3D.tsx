"use client";

// Professor Filipe — full-body 3D avatar, built procedurally with Three.js / React Three Fiber (no model files:
// nothing to license, instant to load, easy to keep on-brand). Beard, round terracotta glasses and cardigan are the
// character's signature (D-18). States follow RF-M17-01; the mouth follows the speech level (RF-M17-02);
// while speaking he makes "beat" gestures with his hands. Motion is damped, and "reduce motion" keeps only expressions.
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { AvatarState } from "./Avatar";
import { Avatar } from "./Avatar";

const C = {
  skin: "#c58d62",
  skinDark: "#a6693f",
  hair: "#8d857c",
  gray: "#b9b2a8",
  beard: "#8a8177",
  tunic: "#eadcbd",
  tunicDark: "#cdb98f",
  mantle: "#2f4a6b",
  stripe: "#efe3c6",
  sash: "#8a5a2b",
  wrap: "#f3ead6",
  band: "#7a4a2a",
  brow: "#5b5249",
  parchment: "#e9d9ae",
  rod: "#7a4a2a",
  shoe: "#5a3d27",
  mouth: "#4a1a14",
  teeth: "#fbf3e6",
};

type V3 = [number, number, number];
type Pose = Record<string, V3>;

const BASE: Pose = {
  spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shR: [0, 0, -0.1], shL: [0, 0, 0.1], elR: [-0.12, 0, 0], elL: [-0.12, 0, 0],
};

function poseFor(state: AvatarState): Pose {
  const p: Pose = JSON.parse(JSON.stringify(BASE));
  switch (state) {
    case "listening":
      p.head = [0.04, 0, 0.1]; p.spine = [0.05, 0, 0]; break;
    case "thinking":
      p.shR = [-0.7, 0.35, -0.2]; p.elR = [-2.15, 0, 0]; p.shL = [-0.3, 0, 0.3]; p.elL = [-1.5, 0, 0];
      p.head = [-0.05, 0.28, 0.08]; break;
    case "happy":
      p.shR = [-0.3, 0, -0.6]; p.shL = [-0.3, 0, 0.6]; p.elR = [-1.1, 0, 0]; p.elL = [-1.1, 0, 0]; p.head = [-0.08, 0, 0]; break;
    case "empathetic":
      p.shR = [-0.6, 0, -0.1]; p.shL = [-0.6, 0, 0.1]; p.elR = [-1.45, 0, 0]; p.elL = [-1.45, 0, 0]; p.head = [0.06, 0, -0.1]; break;
    case "pointing":
      p.shL = [-0.2, 0, 1.2]; p.elL = [-0.1, 0, 0]; p.head = [0, 0.3, 0]; break;
    default:
      break;
  }
  return p;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function Capsule({ r, len, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] }: { r: number; len: number; color: string; pos?: V3; rot?: V3; scale?: V3 }) {
  return (
    <mesh position={pos} rotation={rot} scale={scale} castShadow>
      <capsuleGeometry args={[r, len, 8, 16]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Ball({ r, color, pos = [0, 0, 0], scale = [1, 1, 1], rough = 0.85 }: { r: number; color: string; pos?: V3; scale?: V3; rough?: number }) {
  return (
    <mesh position={pos} scale={scale} castShadow>
      <sphereGeometry args={[r, 28, 20]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function Arm({ side, rig }: { side: "R" | "L"; rig: React.MutableRefObject<Record<string, THREE.Object3D | null>> }) {
  const x = side === "R" ? -0.215 : 0.215;
  return (
    <group ref={(o) => void (rig.current["sh" + side] = o)} position={[x, 0.15, 0]}>
      <Ball r={0.07} color={C.tunic} />
      <Capsule r={0.06} len={0.2} color={C.tunic} pos={[0, -0.16, 0]} />
      <group ref={(o) => void (rig.current["el" + side] = o)} position={[0, -0.31, 0]}>
        <Ball r={0.056} color={C.tunic} />
        <Capsule r={0.05} len={0.18} color={C.tunic} pos={[0, -0.14, 0]} />
        <mesh position={[0, -0.24, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.035, 20]} />
          <meshStandardMaterial color={C.tunicDark} roughness={0.9} />
        </mesh>
        <group position={[0, -0.31, 0]}>
          <Ball r={0.056} color={C.skin} scale={[1, 1.25, 0.7]} />
          <Capsule r={0.016} len={0.04} color={C.skin} pos={[side === "R" ? 0.05 : -0.05, -0.01, 0.02]} rot={[0, 0, side === "R" ? -0.6 : 0.6]} />
          {side === "R" && (
            <group position={[0, -0.02, 0.05]} rotation={[0, 0, Math.PI / 2]}>
              <mesh><cylinderGeometry args={[0.026, 0.026, 0.22, 16]} /><meshStandardMaterial color={C.parchment} roughness={0.9} /></mesh>
              {[-1, 1].map((e) => (
                <mesh key={e} position={[0, e * 0.115, 0]}><cylinderGeometry args={[0.02, 0.02, 0.025, 12]} /><meshStandardMaterial color={C.rod} roughness={0.7} /></mesh>
              ))}
            </group>
          )}
          <group ref={(o) => void (rig.current["index" + side] = o)} visible={false}>
            <Capsule r={0.014} len={0.07} color={C.skin} pos={[0, -0.09, 0.01]} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Head({ rig }: { rig: React.MutableRefObject<Record<string, THREE.Object3D | null>> }) {
  return (
    <group ref={(o) => void (rig.current.head = o)} position={[0, 0.1, 0]} scale={1.42}>
      {/* head, ears, nose */}
      <Ball r={0.15} color={C.skin} scale={[0.95, 1.08, 1]} pos={[0, 0.07, 0]} />
      <Ball r={0.03} color={C.skinDark} pos={[-0.145, 0.07, 0]} scale={[0.45, 1.1, 0.7]} />
      <Ball r={0.03} color={C.skinDark} pos={[0.145, 0.07, 0]} scale={[0.45, 1.1, 0.7]} />
      <Ball r={0.024} color={C.skinDark} pos={[0, 0.04, 0.152]} scale={[1, 1.15, 1]} />
      {/* head wrap (keffiyeh-style cloth of a 1st-century scholar) + grey hair at the sides */}
      <mesh position={[0, 0.1, -0.012]} rotation={[0.12, 0, 0]} scale={[1.0, 1.02, 1.02]} castShadow>
        <sphereGeometry args={[0.168, 32, 24, 0, Math.PI * 2, 0, 1.2]} />
        <meshStandardMaterial color={C.wrap} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.172, -0.004]} rotation={[Math.PI / 2 + 0.1, 0, 0]} scale={[0.97, 1.02, 1]} castShadow>
        <torusGeometry args={[0.157, 0.019, 10, 40]} />
        <meshStandardMaterial color={C.band} roughness={0.8} />
      </mesh>
      <Capsule r={0.05} len={0.16} color={C.wrap} pos={[0, 0.0, -0.15]} rot={[0.25, 0, 0]} scale={[1.8, 1, 0.5]} />
      <Capsule r={0.016} len={0.05} color={C.hair} pos={[-0.148, 0.115, 0.01]} />
      <Capsule r={0.016} len={0.05} color={C.hair} pos={[0.148, 0.115, 0.01]} />
      {/* beard (lower face) and mustache */}
      <mesh position={[0, 0.07, -0.002]} scale={[0.98, 1.08, 1.01]} castShadow>
        <sphereGeometry args={[0.152, 32, 24, 0, Math.PI * 2, 1.95, 1.2]} />
        <meshStandardMaterial color={C.beard} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <Capsule r={0.013} len={0.045} color={C.beard} pos={[-0.03, -0.012, 0.152]} rot={[0, 0, Math.PI / 2 - 0.25]} />
      <Capsule r={0.013} len={0.045} color={C.beard} pos={[0.03, -0.012, 0.152]} rot={[0, 0, Math.PI / 2 + 0.25]} />
      <Ball r={0.085} color={C.beard} pos={[0, -0.06, 0.07]} scale={[1.02, 1.35, 0.85]} />
      {/* mouth */}
      <group ref={(o) => void (rig.current.mouth = o)} position={[0, -0.04, 0.147]}>
        <mesh scale={[0.034, 0.012, 0.02]} ref={(o) => void (rig.current.mouthInner = o)}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color={C.mouth} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.0045, 0.012]} scale={[0.026, 0.0045, 0.006]} ref={(o) => void (rig.current.teeth = o)}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={C.teeth} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0, -0.034, 0.151]} rotation={[0, 0, Math.PI]} ref={(o) => void (rig.current.smile = o)}>
        <torusGeometry args={[0.03, 0.0065, 8, 18, Math.PI * 0.82]} />
        <meshStandardMaterial color={C.teeth} roughness={0.5} />
      </mesh>
      {/* cheeks */}
      <Ball r={0.026} color="#e58f6b" pos={[-0.092, 0.015, 0.128]} scale={[1, 0.8, 0.3]} />
      <Ball r={0.026} color="#e58f6b" pos={[0.092, 0.015, 0.128]} scale={[1, 0.8, 0.3]} />
      {/* eyes */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.056, 0.082, 0.128]} ref={(o) => void (rig.current[s < 0 ? "eyeR" : "eyeL"] = o)}>
          <Ball r={0.024} color="#fbf7ef" scale={[1, 1, 0.55]} />
          <mesh position={[0, 0, 0.012]} ref={(o) => void (rig.current[s < 0 ? "pupilR" : "pupilL"] = o)}>
            <sphereGeometry args={[0.0155, 16, 12]} />
            <meshStandardMaterial color="#241711" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* eyebrows */}
      <group ref={(o) => void (rig.current.browR = o)} position={[-0.056, 0.128, 0.138]}>
        <Capsule r={0.0085} len={0.05} color={C.brow} rot={[0, 0, Math.PI / 2]} />
      </group>
      <group ref={(o) => void (rig.current.browL = o)} position={[0.056, 0.128, 0.138]}>
        <Capsule r={0.0085} len={0.05} color={C.brow} rot={[0, 0, Math.PI / 2]} />
      </group>
    </group>
  );
}

function Filipe({ state, level, reduceMotion }: { state: AvatarState; level: number; reduceMotion: boolean }) {
  const rig = useRef<Record<string, THREE.Object3D | null>>({});
  const cur = useRef<Record<string, V3>>({});
  const g = useRef({ next: 1.2, start: 0, dur: 1, kind: "none" as "none" | "beatR" | "beatL" | "open" });
  const mouth = useRef(0);
  const blink = useRef({ next: 2.5, t: -1 });
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  stateRef.current = state;
  levelRef.current = level;

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const st = stateRef.current;
    const motion = reduceMotion ? 0 : 1;
    const target = poseFor(st);
    const k = 1 - Math.exp(-dt * 7);

    // speaking gestures (beat gestures with hands)
    const speaking = st === "speaking";
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
      const amp = 0.55 + 0.45 * clamp(levelRef.current * 3);
      if (gs.kind === "beatR" || gs.kind === "open") {
        target.shR = [-0.55 * gp * amp, 0, -0.25 - 0.3 * gp];
        target.elR = [-0.12 - 1.1 * gp * amp, 0, 0];
      }
      if (gs.kind === "beatL" || gs.kind === "open") {
        target.shL = [-0.55 * gp * amp, 0, 0.25 + 0.3 * gp];
        target.elL = [-0.12 - 1.1 * gp * amp, 0, 0];
      }
    }
    // breathing, sway and talking head motion
    const breathe = Math.sin(t * 1.7) * 0.012 * motion;
    target.chest = [target.chest[0] + breathe, 0, 0];
    target.spine = [target.spine[0], Math.sin(t * 0.4) * 0.03 * motion, Math.sin(t * 0.5) * 0.015 * motion];
    if (speaking) target.head = [target.head[0] + Math.sin(t * 5.3) * 0.03 * clamp(levelRef.current * 3) * motion, target.head[1] + Math.sin(t * 1.3) * 0.08 * motion, target.head[2]];
    if (st === "listening") target.head = [target.head[0] + Math.max(0, Math.sin(t * 1.9)) * 0.06 * motion, target.head[1], target.head[2]];
    if (st === "idle") target.head = [target.head[0], Math.sin(t * 0.6) * 0.1 * motion, target.head[2]];

    for (const name of Object.keys(target)) {
      const o = rig.current[name];
      if (!o) continue;
      const c = (cur.current[name] ??= [0, 0, 0]);
      for (let i = 0; i < 3; i++) c[i] = lerp(c[i], target[name][i], k);
      o.rotation.set(c[0], c[1], c[2]);
    }
    const root = rig.current.root;
    if (root) root.position.y = st === "happy" ? Math.abs(Math.sin(t * 5)) * 0.05 * motion : 0;

    // pointing finger only when pointing
    const idxL = rig.current.indexL;
    if (idxL) idxL.visible = st === "pointing";

    // mouth: speech level -> opening; closed smile otherwise
    const lv = clamp(levelRef.current * 3.2);
    const wantOpen = speaking ? (reduceMotion ? 0.25 : lv) : 0;
    mouth.current = lerp(mouth.current, wantOpen, 1 - Math.exp(-dt * 22));
    const m = mouth.current;
    const mi = rig.current.mouthInner;
    const teeth = rig.current.teeth;
    const smile = rig.current.smile;
    const happy = st === "happy";
    if (mi) {
      mi.scale.set(0.034 * (1 - 0.3 * m) * (happy ? 1.15 : 1), 0.004 + 0.046 * m + (happy ? 0.008 : 0), 0.02);
      mi.visible = m > 0.06 || happy;
    }
    if (teeth) teeth.visible = m > 0.1 || happy;
    if (smile) {
      smile.visible = m <= 0.06 && !happy;
      const sad = st === "empathetic";
      smile.scale.set(sad ? 0.7 : 1, sad ? 0.5 : 1, 1);
    }

    // eyes: blink, look direction, happy arcs
    const b = blink.current;
    if (t > b.next && b.t < 0) b.t = 0;
    let blinkAmt = 0;
    if (b.t >= 0 && motion) {
      b.t += dt;
      blinkAmt = Math.sin(Math.min(1, b.t / 0.16) * Math.PI);
      if (b.t > 0.16) {
        b.t = -1;
        b.next = t + 2.5 + Math.random() * 3;
      }
    }
    const eyeY = happy ? 0.22 : 1 - 0.92 * blinkAmt;
    for (const s of ["eyeR", "eyeL"]) {
      const e = rig.current[s];
      if (e) e.scale.set(1, eyeY, 1);
    }
    const look = st === "thinking" ? [0.012, 0.01] : st === "pointing" ? [0.012, 0] : [0, 0];
    for (const s of ["pupilR", "pupilL"]) {
      const p = rig.current[s];
      if (p) p.position.set(look[0], look[1], 0.012);
    }
    // eyebrows
    const up = st === "listening" || st === "thinking" ? 0.012 : 0;
    const tilt = st === "empathetic" ? 0.28 : 0;
    const bR = rig.current.browR;
    const bL = rig.current.browL;
    if (bR) {
      bR.position.y = lerp(bR.position.y, 0.128 + up + (happy ? 0.006 : 0), k);
      bR.rotation.z = lerp(bR.rotation.z, -tilt, k);
    }
    if (bL) {
      bL.position.y = lerp(bL.position.y, 0.128 + up + (happy ? 0.006 : 0), k);
      bL.rotation.z = lerp(bL.rotation.z, tilt, k);
    }
  });

  return (
    <group ref={(o) => void (rig.current.root = o)}>
      <group position={[0, 0.8, 0]}>
        {/* long linen tunic down to the ankles, sandals peeking out */}
        <mesh position={[0, -0.39, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.29, 0.8, 36]} />
          <meshStandardMaterial color={C.tunic} roughness={0.92} />
        </mesh>
        <mesh position={[0, -0.78, 0]}>
          <cylinderGeometry args={[0.292, 0.295, 0.035, 36]} />
          <meshStandardMaterial color={C.tunicDark} roughness={0.9} />
        </mesh>
        {[-1, 1].map((s) => (
          <Ball key={s} r={0.07} color={C.shoe} pos={[s * 0.09, -0.79, 0.2]} scale={[1, 0.45, 1.7]} />
        ))}
        <group ref={(o) => void (rig.current.spine = o)} position={[0, 0.02, 0]}>
          <Capsule r={0.175} len={0.16} color={C.tunic} pos={[0, 0.16, 0]} scale={[1.05, 1, 0.85]} />
          {/* sash */}
          <mesh position={[0, 0.03, 0]} scale={[1, 1, 0.86]}>
            <cylinderGeometry args={[0.188, 0.2, 0.065, 32]} />
            <meshStandardMaterial color={C.sash} roughness={0.8} />
          </mesh>
          {/* mantle hanging down the front (indigo with cream stripes) */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.12, 0.2, 0.152]} rotation={[0.08, 0, 0]}>
              <mesh><boxGeometry args={[0.1, 0.58, 0.025]} /><meshStandardMaterial color={C.mantle} roughness={0.9} /></mesh>
              <mesh position={[0, -0.2, 0.014]}><boxGeometry args={[0.1, 0.018, 0.004]} /><meshStandardMaterial color={C.stripe} /></mesh>
              <mesh position={[0, -0.24, 0.014]}><boxGeometry args={[0.1, 0.008, 0.004]} /><meshStandardMaterial color={C.stripe} /></mesh>
            </group>
          ))}
          <group ref={(o) => void (rig.current.chest = o)} position={[0, 0.3, 0]}>
            <Capsule r={0.1} len={0.05} color={C.tunic} pos={[0, 0.1, 0]} rot={[0, 0, Math.PI / 2]} scale={[1, 1, 0.9]} />
            <Ball r={0.2} color={C.mantle} pos={[0, 0.1, -0.01]} scale={[1.35, 0.5, 1.0]} />
            <Ball r={0.2} color={C.stripe} pos={[0, 0.07, -0.01]} scale={[1.37, 0.06, 1.02]} />
            <Arm side="R" rig={rig} />
            <Arm side="L" rig={rig} />
            <group ref={(o) => void (rig.current.neck = o)} position={[0, 0.2, 0]}>
              <mesh position={[0, 0.01, 0]}>
                <cylinderGeometry args={[0.052, 0.058, 0.1, 20]} />
                <meshStandardMaterial color={C.skinDark} roughness={0.9} />
              </mesh>
              <Head rig={rig} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
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
    const y = mode === "full" ? 0.9 : 1.5;
    const z = mode === "full" ? 3.7 : 1.5;
    camera.position.y = lerp(camera.position.y, y + (mode === "full" ? 0.05 : 0), k);
    camera.position.z = lerp(camera.position.z, z, k);
    camera.lookAt(0, mode === "full" ? 0.86 : 1.5, 0);
  });
  return null;
}

export function Avatar3D({ state, level = 0, mode = "full", className }: { state: AvatarState; level?: number; mode?: "full" | "bust"; className?: string }) {
  const webgl = useWebGL();
  const reduce = useReduceMotion();
  const light = useMemo(() => new THREE.Color("#fff3df"), []);
  if (webgl === false) return <Avatar state={state} level={level} size={112} />;
  if (webgl === null) return <div className={className} aria-hidden="true" />;
  return (
    <div className={className} aria-hidden="true" style={{ width: "100%", height: "100%", minHeight: 120 }}>
      <Canvas dpr={[1, 2]} shadows camera={{ position: [0, 1.05, 4.1], fov: 30 }} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={[light, "#8a6a4a", 1.05]} />
        <directionalLight position={[2.5, 4, 3.5]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 1.5, 2]} intensity={0.6} color="#ffd9b8" />
        <Rig mode={mode} />
        <Filipe state={state} level={level} reduceMotion={reduce} />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
      </Canvas>
    </div>
  );
}
