"use client";

// Procedural materials and effects for the immersive scenes (no image files: everything is drawn on a canvas or animated in code, so the environments
// cost no download). Textures are made once per scene and released with it.
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, Color, type InstancedMesh, type Light, Matrix4, Object3D, RepeatWrapping, SRGBColorSpace } from "three";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) => void;

export function makeTexture(paint: Painter, w = 256, h = 256, repeat: [number, number] = [1, 1], seed = 7): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  paint(ctx, w, h, rng(seed));
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A texture made once and disposed when the scene goes away. */
export function useTexture(paint: Painter, w: number, h: number, repeat: [number, number] = [1, 1], seed = 7, deps: unknown[] = []): CanvasTexture {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(() => makeTexture(paint, w, h, repeat, seed), deps);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const shade = (hex: string, k: number) => { const c = new Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };

/** Woven linen: a fine over/under thread pattern with small irregularities. */
export const paintLinen = (base = "#efe6cf"): Painter => (ctx, w, h, r) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const over = ((x >> 1) + (y >> 1)) % 2 === 0;
    ctx.fillStyle = shade(base, (over ? 0.96 : 1.03) + (r() - 0.5) * 0.04);
    ctx.fillRect(x, y, 2, 2);
  }
};

/** Planks of wood with grain lines and knots. `plankW` in px. */
export const paintWood = (base: string, plankW = 64, grain = 0.35): Painter => (ctx, w, h, r) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += plankW) {
    const tone = 0.86 + r() * 0.28;
    ctx.fillStyle = shade(base, tone); ctx.fillRect(x, 0, plankW - 1, h);
    for (let i = 0; i < 26; i++) {
      const gx = x + r() * plankW, wob = (r() - 0.5) * 6;
      ctx.strokeStyle = shade(base, 0.7 + r() * 0.2); ctx.globalAlpha = grain * (0.3 + r() * 0.5); ctx.lineWidth = 0.6 + r();
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + wob, h * 0.3, gx - wob, h * 0.7, gx + wob * 0.5, h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (r() < 0.6) { const ky = r() * h, kx = x + plankW * (0.2 + r() * 0.6); ctx.fillStyle = shade(base, 0.55); ctx.beginPath(); ctx.ellipse(kx, ky, 4 + r() * 4, 7 + r() * 7, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + plankW - 1, 0, 1, h); // the seam between planks
  }
};

/** Hammered metal: soft dents (light and dark dabs) over a base color. */
export const paintHammered = (base: string): Painter => (ctx, w, h, r) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 520; i++) {
    const x = r() * w, y = r() * h, rad = 3 + r() * 9;
    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.20)"); g.addColorStop(0.7, "rgba(0,0,0,0.08)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
};

/** Desert ground: warm sand with ripples, pebbles and darker patches. */
export const paintSand: Painter = (ctx, w, h, r) => {
  ctx.fillStyle = "#d7c096"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(${150 + r() * 40},${120 + r() * 30},${80 + r() * 30},${0.05 + r() * 0.08})`; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 20 + r() * 50, 6 + r() * 18, r() * 3, 0, 7); ctx.fill(); }
  for (let y = 0; y < h; y += 7) { ctx.strokeStyle = `rgba(120,90,50,${0.04 + r() * 0.05})`; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 23 + y) * 2 + r()); ctx.stroke(); }
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(${90 + r() * 70},${80 + r() * 60},${60 + r() * 50},0.55)`; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 1 + r() * 2.2, 0.8 + r() * 1.6, r() * 3, 0, 7); ctx.fill(); }
};

/** Pitch (betume): dark, glossy and uneven, with a few brighter drips. */
export const paintPitch: Painter = (ctx, w, h, r) => {
  ctx.fillStyle = "#2b2118"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(${40 + r() * 35},${30 + r() * 25},${20 + r() * 15},${0.25 + r() * 0.3})`; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 8 + r() * 30, 4 + r() * 14, r() * 3, 0, 7); ctx.fill(); }
  for (let i = 0; i < 24; i++) { const x = r() * w; ctx.fillStyle = "rgba(255,240,220,0.07)"; ctx.fillRect(x, r() * h * 0.6, 1.5 + r() * 2, 20 + r() * 80); }
};

/** Straw and hay: many short warm strokes. */
export const paintHay: Painter = (ctx, w, h, r) => {
  ctx.fillStyle = "#c9a85a"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { ctx.strokeStyle = `rgba(${170 + r() * 60},${130 + r() * 60},${50 + r() * 40},${0.4 + r() * 0.5})`; ctx.lineWidth = 0.7 + r(); const x = r() * w, y = r() * h, a = r() * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (6 + r() * 14), y + Math.sin(a) * (6 + r() * 14)); ctx.stroke(); }
};

/** Cherubim-like embroidery band on the curtains (abstract wings and a sun, no faces), blue/purple/crimson on linen. */
export const paintEmbroidery: Painter = (ctx, w, h) => {
  ctx.fillStyle = "#efe6cf"; ctx.fillRect(0, 0, w, h);
  const colors = ["#33408f", "#7d2a5c", "#b3202f"];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const cx = (col + 0.5) * (w / 3), cy = (row + 0.5) * (h / 3);
    ctx.strokeStyle = colors[(row + col) % 3]; ctx.fillStyle = colors[(row + col + 1) % 3]; ctx.lineWidth = 2.2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.bezierCurveTo(cx + s * 22, cy - 26, cx + s * 52, cy - 18, cx + s * 56, cy + 6); ctx.bezierCurveTo(cx + s * 40, cy - 2, cx + s * 22, cy + 4, cx, cy + 10); ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy + 2, 7, 0, 7); ctx.fillStyle = "#d9a92b"; ctx.fill();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.08)"; for (let i = 0; i < h; i += 3) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
};

/** A flame: a few cones that flicker (scale and sway) and an optional light that flickers with them. */
export function Flame({ size = 1, intensity = 0, color = "#ff9a3c", position = [0, 0, 0] as [number, number, number] }: { size?: number; intensity?: number; color?: string; position?: [number, number, number] }) {
  const g = useRef<Object3D>(null);
  const light = useRef<Light>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, k = 0.85 + Math.sin(t * 11.3 + position[0] * 3) * 0.1 + Math.sin(t * 17.1 + position[2]) * 0.07;
    if (g.current) { g.current.scale.set(1 + (k - 0.85) * 0.4, k, 1 + (k - 0.85) * 0.4); g.current.rotation.z = Math.sin(t * 5.2 + position[0]) * 0.07; }
    if (light.current) light.current.intensity = intensity * (0.8 + (k - 0.85) * 2);
  });
  return (
    <group position={position}>
      <group ref={g}>
        <mesh><coneGeometry args={[0.5 * size, 1.3 * size, 7]} /><meshStandardMaterial color="#ff8a1c" emissive="#ff6a00" emissiveIntensity={1.7} transparent opacity={0.9} /></mesh>
        <mesh position={[0, -0.12 * size, 0]}><coneGeometry args={[0.28 * size, 0.85 * size, 6]} /><meshStandardMaterial color="#ffe28a" emissive="#ffcc40" emissiveIntensity={2.2} /></mesh>
      </group>
      {intensity > 0 && <pointLight ref={light as never} color={color} distance={14} intensity={intensity} position={[0, 0.6 * size, 0]} />}
    </group>
  );
}

/** Rising smoke: soft puffs that drift up, grow and fade, in one instanced mesh. */
export function Smoke({ count = 14, height = 6, spread = 0.6, color = "#d9d4ca", radius = 0.35, position = [0, 0, 0] as [number, number, number] }: { count?: number; height?: number; spread?: number; color?: string; radius?: number; position?: [number, number, number] }) {
  const mesh = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => { const r = rng(11); return Array.from({ length: count }, () => ({ phase: r(), dx: (r() - 0.5) * spread, dz: (r() - 0.5) * spread, sway: 0.5 + r() })); }, [count, spread]);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current; if (!m) return;
    seeds.forEach((s, i) => {
      const k = (clock.elapsedTime * 0.18 + s.phase) % 1; // 0 at the fire, 1 at the top
      dummy.position.set(s.dx * k * 3 + Math.sin(clock.elapsedTime * 0.7 + i) * 0.25 * k * s.sway, k * height, s.dz * k * 3);
      const sc = radius * (0.6 + k * 2.6);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    (m.material as { opacity: number }).opacity = 0.32;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} position={position} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={color} transparent opacity={0.3} depthWrite={false} roughness={1} />
    </instancedMesh>
  );
}

/** Many copies of one geometry, placed once: `items` are [x, y, z, rotY, scale]. One draw call instead of hundreds. */
export function Instances({ items, children, castShadow = false }: { items: [number, number, number, number?, number?][]; children: React.ReactNode; castShadow?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const d = new Object3D(), mat = new Matrix4();
    items.forEach(([x, y, z, ry = 0, sc = 1], i) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.setScalar(sc); d.updateMatrix(); mat.copy(d.matrix); m.setMatrixAt(i, mat); });
    m.instanceMatrix.needsUpdate = true;
  }, [items]);
  return <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} frustumCulled={false}>{children}</instancedMesh>;
}
