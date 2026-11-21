// Movement of the visitor (spec 8.16): collision with sliding, joystick and keyboard input, zone loading and level of detail. Pure functions.
import type { Collider, EnvironmentPackage, Hotspot, Zone } from "./package";

export type V2 = [number, number];

/** True when a circle of radius `r` at `p` touches a collider. */
export function hits(p: V2, r: number, c: Collider): boolean {
  if (c.type === "circle") return Math.hypot(p[0] - c.c[0], p[1] - c.c[1]) < c.r + r;
  const cx = Math.max(c.min[0], Math.min(p[0], c.max[0]));
  const cz = Math.max(c.min[1], Math.min(p[1], c.max[1]));
  return Math.hypot(p[0] - cx, p[1] - cz) < r;
}

/**
 * Moves from `pos` by `delta`. Each axis is tried on its own, so the visitor slides along a wall instead of stopping dead. The walkable
 * rectangle `bounds` is a wall too. A long step is split so it can never jump through a thin collider.
 */
export function move(pos: V2, delta: V2, r: number, colliders: Collider[], bounds: { min: V2; max: V2 }): V2 {
  const len = Math.hypot(delta[0], delta[1]);
  const steps = Math.max(1, Math.ceil(len / (r * 0.8)));
  let p: V2 = [pos[0], pos[1]];
  for (let i = 0; i < steps; i++) {
    const dx = delta[0] / steps, dz = delta[1] / steps;
    const tx: V2 = [Math.min(bounds.max[0] - r, Math.max(bounds.min[0] + r, p[0] + dx)), p[1]];
    if (!colliders.some((c) => hits(tx, r, c))) p = tx;
    const tz: V2 = [p[0], Math.min(bounds.max[1] - r, Math.max(bounds.min[1] + r, p[1] + dz))];
    if (!colliders.some((c) => hits(tz, r, c))) p = tz;
  }
  return p;
}

/** World direction of travel from the stick/keys (x = right, y = forward, each -1..1) and the way the visitor faces (yaw in radians; 0 looks toward -z). */
export function worldDirection(input: V2, yaw: number): V2 {
  const [sx, sy] = input;
  return [sx * Math.cos(yaw) - sy * Math.sin(yaw), -sx * Math.sin(yaw) - sy * Math.cos(yaw)];
}

/** Keyboard (WASD / arrows) to a stick vector, with the diagonal normalised so it is not faster. */
export function keysToStick(keys: ReadonlySet<string>): V2 {
  const x = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const y = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
  const l = Math.hypot(x, y);
  return l > 1 ? [x / l, y / l] : [x, y];
}

/** Virtual joystick: the thumb's offset from the centre, as a stick vector with a dead zone (so a resting thumb does not drift). Screen y grows downward. */
export function stickFromOffset(dx: number, dy: number, radius: number, dead = 0.15): V2 {
  const len = Math.hypot(dx, dy);
  const l = len / radius;
  if (l < dead) return [0, 0];
  const m = Math.min(1, (l - dead) / (1 - dead));
  return [(dx / len) * m, (-dy / len) * m];
}

/** Zones to keep built: those within `load`, plus those already built that are still within `unload` (hysteresis, so a zone does not flicker at its edge). */
export function activeZones(zones: Zone[], pos: V2, current: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const z of zones) {
    const d = Math.hypot(pos[0] - z.center[0], pos[1] - z.center[1]);
    if (d < z.load || (current.has(z.id) && d < z.unload)) out.add(z.id);
  }
  return out;
}

/** Colliders of the zones that are built. */
export const collidersOf = (zones: Zone[], active: ReadonlySet<string>): Collider[] => zones.filter((z) => active.has(z.id)).flatMap((z) => z.colliders);

/** Level of detail by distance to the visitor: 0 high, 1 medium, 2 low. */
export const detailFor = (distance: number): 0 | 1 | 2 => (distance < 14 ? 0 : distance < 32 ? 1 : 2);

/** The nearest hotspot the visitor can open (inside its radius), or null. */
export function nearestHotspot(hotspots: Hotspot[], pos: V2, active: ReadonlySet<string>): Hotspot | null {
  let best: Hotspot | null = null, bd = Infinity;
  for (const h of hotspots) {
    if (!active.has(h.zone)) continue;
    const d = Math.hypot(pos[0] - h.at[0], pos[1] - h.at[2]);
    if (d <= h.radius && d < bd) { best = h; bd = d; }
  }
  return best;
}

/** Yaw that makes the visitor face the point (x, z) from `from`. */
export const yawToward = (from: V2, to: V2): number => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));

/** Is the package's spawn point free (not inside a collider)? A package with a blocked start is a bug in the data. */
export const spawnIsFree = (p: EnvironmentPackage): boolean => !p.zones.flatMap((z) => z.colliders).some((c) => hits(p.spawn as V2, p.radius, c));
