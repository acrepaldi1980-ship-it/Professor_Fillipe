// Environment package (spec 8.16, Prompt 3.1): everything an immersive environment needs, in one validated object: zones with their colliders,
// hotspots with verses, sounds, the guide's stations and the historical fact sheet with sources. The engine only knows this format, so a new
// environment (the Tabernacle, Herod's Temple...) is data plus a scene component, never a change in the engine.
import { z } from "zod";

const v2 = z.tuple([z.number().finite(), z.number().finite()]);
const v3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const ref = z.string().regex(/^[0-9A-Z]{3}\.\d+(\.\d+)?(-[0-9A-Z]{3}\.\d+(\.\d+)?)?$/);
const id = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);

export const Collider = z.discriminatedUnion("type", [
  /** `floor`: the collider only exists for a visitor standing on that floor (see Floor); without it, on every floor. */
  z.object({ type: z.literal("box"), min: v2, max: v2, floor: z.string().max(40).optional() }),
  z.object({ type: z.literal("circle"), c: v2, r: z.number().positive(), floor: z.string().max(40).optional() }),
]);

/**
 * Where the visitor can stand and how high: a rectangle with a height at each end (a deck has y0 = y1, a ramp climbs along `axis`).
 * Decks stacked at the same x/z are told apart by the visitor's current height: the floor whose height is closest wins, so a ramp lets him go up.
 */
export const Floor = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  min: v2,
  max: v2,
  y0: z.number().min(-20).max(40),
  y1: z.number().min(-20).max(40),
  /** The ramp rises from y0 (at the min side of this axis) to y1 (at the max side). */
  axis: z.enum(["x", "z"]).default("z"),
});

/** Sky and distance of an environment (the desert tabernacle and a flooded plain do not look alike). */
export const Sky = z.object({
  background: z.string().default("#bcd9ea"),
  fog: z.string().default("#e9d9b4"),
  fogNear: z.number().default(30),
  fogFar: z.number().default(80),
  far: z.number().min(50).max(600).default(120),
});

export const Zone = z.object({
  id,
  name: z.string().min(2).max(60),
  /** Scene component key in the scene registry (the visual part of the zone). */
  /** Scene component key (built in code) or, with `model`, "glb": the zone is a GLB file downloaded only when the visitor gets near. */
  scene: id,
  model: z.object({ url: z.string().url().max(500), scale: z.number().positive().max(100).default(1), y: z.number().min(-20).max(20).default(0), size: z.number().int().positive().optional() }).optional(),
  center: v2,
  /** The zone is built when the visitor is closer than `load` meters to its centre and released when farther than `unload` (hysteresis). */
  load: z.number().positive(),
  unload: z.number().positive(),
  colliders: z.array(Collider).max(400).default([]),
});

export const Hotspot = z.object({
  id,
  zone: id,
  label: z.string().min(2).max(60),
  text: z.string().min(5).max(600),
  refs: z.array(ref).max(6).default([]),
  /** What this point rests on (the consultant's three layers): what the Scriptures say, what history supports, or what is an artistic reconstruction. */
  basis: z.enum(["escritura", "historia", "reconstrucao"]).optional(),
  at: v3,
  /** Distance in meters at which the visitor can open it. */
  radius: z.number().positive().max(40).default(2.5),
  /** On which floor it can be opened (a deck of the ark); without it, on any. */
  floor: z.string().max(40).optional(),
});

export const Sound = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("ambient"), layer: z.enum(["wind", "camp"]), volume: z.number().min(0).max(1).default(0.25) }),
  z.object({ id, kind: z.literal("spatial"), layer: z.enum(["fire", "murmur"]), at: v3, volume: z.number().min(0).max(1).default(0.5), radius: z.number().positive().default(10) }),
]);

export const Station = z.object({
  id,
  title: z.string().min(2).max(80),
  at: v2,
  /** Where the visitor looks when the station starts (x, z). */
  look: v2,
  /** The floor the guide takes him to (a deck of the ark); without it he keeps his height. */
  floor: z.string().max(40).optional(),
  /** What the guide says here (short, ends with a question: RA-06). */
  script: z.string().min(10).max(700),
  refs: z.array(ref).max(6).default([]),
});

export const EnvironmentPackage = z.object({
  id,
  title: z.string().min(3).max(80),
  era: z.string().max(80),
  refs: z.array(ref).max(10).default([]),
  /** Eye height (m), walking speed (m/s) and the visitor's collision radius (m). */
  eye: z.number().min(1.2).max(2).default(1.6),
  speed: z.number().min(0.5).max(4).default(2.2),
  radius: z.number().min(0.1).max(0.8).default(0.35),
  spawn: v2,
  spawnYaw: z.number().default(0),
  /** Walkable limit: the visitor cannot leave this rectangle. */
  bounds: z.object({ min: v2, max: v2 }),
  zones: z.array(Zone).min(1).max(12),
  floors: z.array(Floor).max(30).default([]),
  sky: Sky.optional(),
  hotspots: z.array(Hotspot).max(60).default([]),
  sounds: z.array(Sound).max(20).default([]),
  stations: z.array(Station).max(20).default([]),
  /** Historical fact sheet with sources (RA-09: nothing without a source). */
  sheet: z.object({
    summary: z.string().min(20).max(1200),
    sources: z.array(z.string().min(3).max(300)).min(1).max(12),
    uncertainty: z.string().max(600).optional(),
  }),
}).superRefine((p, ctx) => {
  const zoneIds = new Set(p.zones.map((z) => z.id));
  if (zoneIds.size !== p.zones.length) ctx.addIssue({ code: "custom", message: "duplicate zone id" });
  for (const z of p.zones) if (z.unload <= z.load) ctx.addIssue({ code: "custom", message: `zone ${z.id}: unload must be greater than load` });
  for (const h of p.hotspots) if (!zoneIds.has(h.zone)) ctx.addIssue({ code: "custom", message: `hotspot ${h.id}: unknown zone ${h.zone}` });
  if (new Set(p.hotspots.map((h) => h.id)).size !== p.hotspots.length) ctx.addIssue({ code: "custom", message: "duplicate hotspot id" });
});
export type EnvironmentPackage = z.infer<typeof EnvironmentPackage>;
export type Zone = z.infer<typeof Zone>;
export type Hotspot = z.infer<typeof Hotspot>;
export type Collider = z.infer<typeof Collider>;
export type Floor = z.infer<typeof Floor>;
export type Sky = z.infer<typeof Sky>;
export type Station = z.infer<typeof Station>;
