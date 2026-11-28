// Shared cache of the teacher's answers (free performance work, 28/11/2026). The same standalone question ("Quem foi Davi?") is answered again and again, and each answer
// costs free-model quota (8,000 tokens per minute) and 5 to 25 seconds. A checked answer is kept in the library database and served to the next student who asks the same.
//
// What goes in, and what never does (the cache is shared between students, so it must hold nothing personal):
//  - only first questions of a free-study conversation (no history, no guided mode, no extra sources), in the "ask" intent, answered cleanly (not degraded, not
//    pastoral, no outside research, topic clearly biblical, the answer actually found its sources);
//  - the student's name is replaced by a placeholder; an answer that repeats the student's goals, role or what was said in earlier sessions is NOT kept;
//  - the key is a hash of the (normalized) subject plus the settings that change the answer (language, Bible version, lenses, level, minor): the question text is not stored.
import { createHash } from "node:crypto";
import { findEntities, subjectOf } from "../knowledge/entities";
import { refQuery } from "../knowledge/reference-db";
import { teacherResponseSchema, type TeacherResponse } from "./schema";

/** Bump when the prompt, the rules or the library change enough that old answers should not be served. */
export const ANSWER_CACHE_REV = "1";
export const NAME_TOKEN = "{{nome}}";
const TTL_DAYS = 14;

export interface AnswerCache {
  get(key: string): Promise<TeacherResponse | null>;
  put(key: string, response: TeacherResponse): Promise<void>;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The question reduced to what it is about: no accents, case or punctuation; for "about a Bible person or place" questions, only the names ("Quem foi Davi?" and "Me fale sobre Davi" share an answer). */
export function normalizeQuestion(text: string): string {
  const entities = findEntities(text, 3, false);
  const subject = entities.length ? subjectOf(text) : "";
  const base = entities.length && subject && subject.split(/\s+/).length <= 3 ? subject : text;
  return fold(base).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface KeyInput { text: string; locale: string; versionId: string; lenses: string[]; level: string; minor: boolean; layersVersion?: string | number | null }
export function cacheKey(i: KeyInput): string {
  const parts = [ANSWER_CACHE_REV, i.layersVersion ?? "", i.locale, i.versionId, [...i.lenses].sort().join(","), i.level, i.minor ? "minor" : "adult", normalizeQuestion(i.text)];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Can this question be answered from (and stored in) the shared cache at all? Short, standalone, first question of a free-study conversation. */
export function eligibleQuestion(i: { text: string; intent: string; historyLength: number; mode?: string; hasModeContext: boolean; hasExtraSources: boolean }): boolean {
  const t = i.text.trim();
  return i.intent === "ask" && !i.historyLength && (!i.mode || i.mode === "free") && !i.hasModeContext && !i.hasExtraSources && t.length >= 3 && t.length <= 160 && t.split(/\s+/).length <= 20;
}

const shares = (text: string, source: string, n = 4) => {
  const w = fold(source).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const hay = ` ${fold(text).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ")} `;
  for (let i = 0; i + n <= w.length; i++) if (hay.includes(` ${w.slice(i, i + n).join(" ")} `)) return true;
  return false;
};

export interface ProfileForCache { preferred_name: string; goals: string[]; ministry_role?: string | null; last_summaries: string[] }

/** The answer with the student's name taken out, or null when it must not be shared (it repeats something private, or the name cannot be replaced safely). */
export function depersonalize(r: TeacherResponse, p: ProfileForCache): TeacherResponse | null {
  const name = p.preferred_name.trim();
  if (name.length < 3) return null;
  // a name that is also a Bible name ("Davi", "Ana") cannot be told apart from the story: such answers are served but never stored
  if (findEntities(name, 1, false).length) return null;
  const all = `${r.speech}\n${r.display_markdown}\n${r.next_options.map((o) => o.label).join("\n")}`;
  const foldedAll = fold(all);
  for (const g of [...p.goals, p.ministry_role ?? ""].map((x) => fold(x).trim()).filter((x) => x.length >= 5)) if (foldedAll.includes(g)) return null;
  for (const s of p.last_summaries) if (shares(all, s)) return null;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu");
  const swap = (t: string) => t.replace(re, NAME_TOKEN);
  return { ...r, speech: swap(r.speech), display_markdown: swap(r.display_markdown), next_options: r.next_options.map((o) => ({ ...o, label: swap(o.label) })) };
}

export function personalize(r: TeacherResponse, name: string): TeacherResponse {
  const put = (t: string) => t.split(NAME_TOKEN).join(name);
  return { ...r, speech: put(r.speech), display_markdown: put(r.display_markdown), next_options: r.next_options.map((o) => ({ ...o, label: put(o.label) })) };
}

/** Was this turn's answer clean enough to be kept for everybody? */
export function worthKeeping(i: { degraded?: boolean; pastoral: boolean; externalUsed: boolean; textFallback?: boolean; topicVerdict: string; overWordLimit: boolean; removedCitations: number; answered: boolean; response: TeacherResponse }): boolean {
  return !i.degraded && !i.pastoral && !i.externalUsed && !i.textFallback && i.topicVerdict === "in" && !i.overWordLimit && i.removedCitations === 0 && i.answered && !i.response.pastoral_flag && i.response.speech.length >= 60 && i.response.citations.length > 0;
}

/** The shared cache in the library database (a role that can only touch the `answer_cache` table). Never throws: a cache that fails is a cache that misses. */
export class NeonAnswerCache implements AnswerCache {
  constructor(private url = process.env.CACHE_DATABASE_URL) {}
  async get(key: string): Promise<TeacherResponse | null> {
    if (!this.url) return null;
    try {
      const rows = await Promise.race([
        refQuery<{ response: unknown }>(`select response from answer_cache where key = $1 and created_at > now() - interval '${TTL_DAYS} days'`, [key], this.url),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("cache_timeout")), 700)),
      ]);
      const parsed = teacherResponseSchema.safeParse(rows[0]?.response);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  async put(key: string, response: TeacherResponse): Promise<void> {
    if (!this.url) return;
    try {
      await refQuery(`insert into answer_cache (key, response) values ($1, $2::jsonb) on conflict (key) do update set response = excluded.response, created_at = now()`, [key, JSON.stringify(response)], this.url);
      if (Math.random() < 0.02) await refQuery(`delete from answer_cache where created_at < now() - interval '30 days'`, [], this.url);
    } catch {
      /* a cache that cannot be written is not an error for the student */
    }
  }
}
