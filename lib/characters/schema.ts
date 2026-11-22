// "Vida dos Personagens" (módulo M18): the life of a biblical person told in illustrated chapters, from birth to death, every chapter tied to a passage.
// Rules: RA-09 (nothing without a source: each chapter cites a passage; what the Bible does not record is said so), RA-20 (the scene engine never draws the
// face of anyone, Jesus only as a silhouette seen from behind or far away, God only as light), RA-14/19 (no side taken between traditions).
import { z } from "zod";

const ref = z.string().regex(/^[0-9A-Z]{3}\.\d+(\.\d+)?(-[0-9A-Z]{3}\.\d+(\.\d+)?)?$/);
export const Biome = z.enum(["desert", "pasture", "mountain", "river", "sea", "city", "wilderness", "field", "inside", "garden"]);
export const TimeOfDay = z.enum(["dawn", "day", "dusk", "night"]);
export const Weather = z.enum(["clear", "storm", "rain", "fog"]);
export const FeatureKind = z.enum([
  "palm", "olive", "cedar", "fig", "oak", "tent", "altar", "fire", "flock", "camel", "donkey", "well", "boat", "wall", "gate", "temple", "throne", "bars", "cave", "ark",
  "tablets", "lamp", "scroll", "bread", "crown", "sword", "sling", "harp", "net", "vine", "wheat", "stones", "rainbow", "lightning", "star", "tower", "house", "bush", "cross_far", "fish", "chariot", "ladder", "coffin", "table", "scales", "dove",
]);
export const FigureKind = z.enum(["man", "woman", "child", "elder", "warrior", "king", "priest", "shepherd", "jesus", "angel", "crowd"]);
export const Pose = z.enum(["stand", "kneel", "raise", "walk", "sit", "lie", "back"]);

export const Feature = z.object({ kind: FeatureKind, x: z.number().min(-10).max(110), z: z.number().min(0).max(1).default(0.5), s: z.number().min(0.3).max(3).default(1) });
export const Figure = z.object({ kind: FigureKind, x: z.number().min(-10).max(110), z: z.number().min(0).max(1).default(0.7), pose: Pose.default("stand"), robe: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), s: z.number().min(0.4).max(2.5).default(1), holds: FeatureKind.optional() });
export const SceneSpec = z.object({
  biome: Biome,
  time: TimeOfDay.default("day"),
  weather: Weather.default("clear"),
  features: z.array(Feature).max(14).default([]),
  figures: z.array(Figure).max(10).default([]),
  /** The presence of God, only as a ray of light from above (RA-20). */
  light: z.boolean().default(false),
});

export const Chapter = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,40}$/),
  title: z.string().min(3).max(70),
  /** Life stage, to group the chapters (Nascimento, Infância, Chamado, Maturidade, Morte...). */
  stage: z.string().min(3).max(30),
  ref: ref,
  /** Age or time in the life, as the text gives it; approximate dates follow the project's conservative chronology (D-07) and are marked as such. */
  when: z.string().max(60).optional(),
  place: z.string().max(40).optional(),
  scene: SceneSpec,
  /** What the Bible says, told simply (pt-BR, up to 90 words). */
  text: z.string().min(30).max(700),
  /** `escritura` = what the passage says; `tradicao` = a tradition outside the text, always said so; `reconstrucao` = artistic detail. */
  basis: z.enum(["escritura", "tradicao", "reconstrucao"]).default("escritura"),
  /** Ends with a question that brings the word back to the student (RA-06). */
  question: z.string().min(8).max(200),
});

export const Place = z.object({ key: z.string().max(40), name: z.string().max(40), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
export const Kin = z.object({ rel: z.string().max(24), name: z.string().max(40), slug: z.string().optional(), ref: ref.optional() });

export const Character = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  name: z.string().min(2).max(40),
  /** Short epithet: "o pai da fé". */
  title: z.string().max(60),
  /** 1 = curated with full experience; 2 = curated, shorter; 3 = automatic card from the knowledge graph. */
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  era: z.enum(["origens", "patriarcas", "exodo", "conquista", "juizes", "reino", "exilio", "retorno", "intertestamentario", "jesus", "igreja"]),
  testament: z.enum(["AT", "NT"]),
  /** Id of this person in the knowledge graph (kg_entities), to link relations and keep the automatic cards from repeating curated people. */
  kgId: z.string().regex(/^person:[\w.-]+$/).optional(),
  /** Accent color of the illustrated book (a hue that sets the cover). */
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  born: z.object({ label: z.string().max(170), ref: ref.optional() }),
  died: z.object({ label: z.string().max(170), ref: ref.optional() }),
  summary: z.string().min(30).max(320),
  places: z.array(Place).max(14).default([]),
  family: z.array(Kin).max(14).default([]),
  /** Other people whose lives cross this one (slugs). */
  crosses: z.array(z.string()).max(12).default([]),
  chapters: z.array(Chapter).min(3).max(40),
  /** Short lessons for review cards, each tied to a passage. */
  lessons: z.array(z.object({ text: z.string().min(10).max(200), ref })).max(6).default([]),
});
export type Character = z.infer<typeof Character>;
export type Chapter = z.infer<typeof Chapter>;
export type SceneSpec = z.infer<typeof SceneSpec>;

export const ERAS: Record<Character["era"], { name: string; span: string }> = {
  origens: { name: "Origens", span: "Gênesis 1–11" }, patriarcas: { name: "Patriarcas", span: "c. 2000–1650 a.C." }, exodo: { name: "Êxodo e deserto", span: "c. 1500–1400 a.C." },
  conquista: { name: "Conquista", span: "c. 1400–1350 a.C." }, juizes: { name: "Juízes", span: "c. 1350–1050 a.C." }, reino: { name: "Reino", span: "c. 1050–586 a.C." },
  exilio: { name: "Exílio", span: "586–539 a.C." }, retorno: { name: "Retorno", span: "539–430 a.C." }, intertestamentario: { name: "Entre os Testamentos", span: "430 a.C.–5 a.C." },
  jesus: { name: "Vida de Jesus", span: "c. 5 a.C.–30 d.C." }, igreja: { name: "Igreja primitiva", span: "30–100 d.C." },
};
