// Curated lives (tiers 1 and 2). Each person is one file in ./data; adding a person is adding a line here.
import { ABRAAO } from "./data/abraao";
import { DAVI } from "./data/davi";
import { JOSE_DO_EGITO } from "./data/jose-do-egito";
import { MARIA } from "./data/maria";
import { MOISES } from "./data/moises";
import { NOE } from "./data/noe";
import { PAULO } from "./data/paulo";
import { RUTE } from "./data/rute";
import type { Character } from "./schema";

/** In the order of the Bible, so the list reads as the story does. */
export const CURATED: Character[] = [NOE, ABRAAO, JOSE_DO_EGITO, MOISES, RUTE, DAVI, MARIA, PAULO];
const BY_ID = new Map(CURATED.map((c) => [c.id, c]));
export const getCurated = (id: string) => BY_ID.get(id);
export const curatedKgIds = () => new Set(CURATED.flatMap((c) => (c.kgId ? [c.kgId] : [])));

export interface CharacterSummary { id: string; name: string; title: string; tier: 1 | 2 | 3; era: Character["era"] | null; color: string; chapters: number; period: string | null; born: string | null; died: string | null }
export const summarize = (c: Character): CharacterSummary => ({ id: c.id, name: c.name, title: c.title, tier: c.tier, era: c.era, color: c.color, chapters: c.chapters.length, period: null, born: c.born.label, died: c.died.label });

/** A landscape for a person who has no curated life yet: deterministic from the id, no figures (so no one is drawn wrongly), with a symbol on the ground. */
import { SceneSpec } from "./schema";
const hashId = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function autoScene(id: string, period?: string | null): SceneSpec {
  const h = hashId(id);
  const biomes = ["desert", "pasture", "mountain", "river", "field", "wilderness", "city", "garden"] as const;
  const times = ["dawn", "day", "dusk", "day"] as const;
  const trees = ["palm", "olive", "cedar", "fig", "oak"] as const;
  const marks = ["scroll", "lamp", "tent", "well", "altar", "stones", "house", "flock"] as const;
  const pick = <T,>(a: readonly T[], n: number) => a[(h >>> n) % a.length];
  void period;
  return SceneSpec.parse({ biome: pick(biomes, 0), time: pick(times, 3), weather: "clear", light: false, figures: [], features: [{ kind: pick(trees, 5), x: 14 + (h % 20), z: 0.4, s: 1 }, { kind: pick(marks, 8), x: 50, z: 0.7, s: 1.15 }, { kind: pick(trees, 11), x: 80 - (h % 14), z: 0.45, s: 1 }] });
}
