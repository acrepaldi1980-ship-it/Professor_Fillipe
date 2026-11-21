// Environment package (spec 8.16, Prompt 3.1): everything an immersive environment needs, in one validated object: zones with their colliders,
// hotspots with verses, sounds, the guide's stations and the historical fact sheet with sources. The engine only knows this format, so a new
// environment (the Tabernacle, Herod's Temple...) is data plus a scene component, never a change in the engine.
import { z } from "zod";

const v2 = z.tuple([z.number().finite(), z.number().finite()]);
const v3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const ref = z.string().regex(/^[0-9A-Z]{3}\.\d+(\.\d+)?(-[0-9A-Z]{3}\.\d+(\.\d+)?)?$/);
const id = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);

export const Collider = z.discriminatedUnion("type", [
  z.object({ type: z.literal("box"), min: v2, max: v2 }),
  z.object({ type: z.literal("circle"), c: v2, r: z.number().positive() }),
]);

export const Zone = z.object({
  id,
  name: z.string().min(2).max(60),
  /** Scene component key in the scene registry (the visual part of the zone). */
  scene: id,
  center: v2,
  /** The zone is built when the visitor is closer than `load` meters to its centre and released when farther than `unload` (hysteresis). */
  load: z.number().positive(),
  unload: z.number().positive(),
  colliders: z.array(Collider).max(200).default([]),
});

export const Hotspot = z.object({
  id,
  zone: id,
  label: z.string().min(2).max(60),
  text: z.string().min(5).max(600),
  refs: z.array(ref).max(6).default([]),
  at: v3,
  /** Distance in meters at which the visitor can open it. */
  radius: z.number().positive().max(12).default(2.5),
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
export type Station = z.infer<typeof Station>;
