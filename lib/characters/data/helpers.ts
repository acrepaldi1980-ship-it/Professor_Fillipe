// Short forms to author scenes: features as [kind, x, z?, scale?], figures as [kind, x, z?, pose?, holds?, robe?].
import type { z } from "zod";
import { Chapter, Character, SceneSpec } from "../schema";

type Biome = z.infer<typeof SceneSpec>["biome"];
type Time = z.infer<typeof SceneSpec>["time"];
type Fk = z.infer<typeof SceneSpec>["features"][number]["kind"];
type Pk = z.infer<typeof SceneSpec>["figures"][number]["kind"];
type Pose = z.infer<typeof SceneSpec>["figures"][number]["pose"];
export type F = [Fk, number, number?, number?];
export type P = [Pk, number, number?, Pose?, Fk?, string?];

export const sc = (biome: Biome, time: Time, features: F[], figures: P[] = [], o: { weather?: "clear" | "storm" | "rain" | "fog"; light?: boolean } = {}) =>
  SceneSpec.parse({
    biome, time, weather: o.weather ?? "clear", light: o.light ?? false,
    features: features.map(([kind, x, z, s]) => ({ kind, x, z: z ?? 0.5, s: s ?? 1 })),
    figures: figures.map(([kind, x, z, pose, holds, robe]) => ({ kind, x, z: z ?? 0.75, pose: pose ?? "stand", holds, robe })),
  });

type Ch = Omit<z.input<typeof Chapter>, "scene" | "id"> & { id?: string; scene: z.infer<typeof SceneSpec> };
/** Builds a character, giving each chapter an id from its position and validating everything at load time. */
export const character = (c: Omit<z.input<typeof Character>, "chapters"> & { chapters: Ch[] }) =>
  Character.parse({ ...c, chapters: c.chapters.map((ch, i) => ({ ...ch, id: ch.id ?? `c${String(i + 1).padStart(2, "0")}` })) });
