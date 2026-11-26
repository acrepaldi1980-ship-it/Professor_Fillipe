// Reading plans (spec 8.24, RF-M24-03): which chapters to read each day. Pure (no network, no database): the schedule is built here and stored with the plan.
import { BOOKS } from "../knowledge/books";
import counts from "./verse-counts.json";

export interface PlanDay { day: number; chapters: string[] }
export type Schedule = PlanDay[];

const VERSES = counts as Record<string, number[]>;
const CODES = BOOKS.map((b) => b.code);
export const NT_CODES = CODES.slice(CODES.indexOf("MAT"));
export const OT_CODES = CODES.slice(0, CODES.indexOf("MAT"));

/** "JHN.3" for every chapter of the given books, in the order of the Bible. */
export function chaptersOf(codes: string[]): string[] {
  return codes.flatMap((c) => (VERSES[c] ?? []).map((_, i) => `${c}.${i + 1}`));
}
export const versesIn = (chapter: string): number => { const [b, c] = chapter.split("."); return VERSES[b]?.[Number(c) - 1] ?? 0; };
export const totalVerses = (book: string): number => (VERSES[book] ?? []).reduce((a, b) => a + b, 0);
export const chapterCount = (book: string): number => (VERSES[book] ?? []).length;

/** Splits the chapters, in order, into `days` days of about the same number of VERSES (a day is never empty while there are chapters left; a long chapter is never cut). */
export function distribute(chapters: string[], days: number): Schedule {
  const n = Math.max(1, Math.min(Math.floor(days), chapters.length || 1));
  const weights = chapters.map((c) => Math.max(1, versesIn(c)));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Schedule = Array.from({ length: n }, (_, i) => ({ day: i + 1, chapters: [] }));
  let acc = 0, day = 0;
  chapters.forEach((c, i) => {
    // the day whose share of the total contains the middle of this chapter, never going back, leaving at least one chapter for each remaining day
    const mid = acc + weights[i] / 2;
    let want = Math.min(n - 1, Math.floor((mid / total) * n));
    want = Math.max(day, want);
    const left = chapters.length - i;
    if (n - 1 - want >= left) want = Math.max(day, n - left);
    day = want;
    out[day].chapters.push(c);
    acc += weights[i];
  });
  // a day left empty (very short plans over long chapters) takes the last chapter of the previous day that has more than one
  for (let d = 0; d < n; d++) if (!out[d].chapters.length) for (let p = d - 1; p >= 0; p--) if (out[p].chapters.length > 1) { out[d].chapters.unshift(out[p].chapters.pop()!); break; }
  return out;
}

export interface CatalogPlan { key: string; name: string; description: string; days: number; build: () => Schedule }

export const CATALOG: CatalogPlan[] = [
  { key: "bible-1y", name: "Bíblia em 1 ano", description: "Do Gênesis ao Apocalipse em 365 dias, cerca de 3 capítulos por dia.", days: 365, build: () => distribute(chaptersOf(CODES), 365) },
  { key: "bible-90", name: "Bíblia em 90 dias", description: "A Bíblia inteira em 90 dias, para quem quer um ritmo intenso (cerca de 13 capítulos por dia).", days: 90, build: () => distribute(chaptersOf(CODES), 90) },
  { key: "nt-90", name: "Novo Testamento em 90 dias", description: "Os 260 capítulos do Novo Testamento em 90 dias, uns 3 por dia.", days: 90, build: () => distribute(chaptersOf(NT_CODES), 90) },
  { key: "gospels-30", name: "Os quatro Evangelhos em 30 dias", description: "Mateus, Marcos, Lucas e João em 30 dias: conhecer Jesus de perto.", days: 30, build: () => distribute(chaptersOf(["MAT", "MRK", "LUK", "JHN"]), 30) },
  { key: "psalms-proverbs-31", name: "Salmos e Provérbios em 31 dias", description: "Cada dia, 5 salmos e 1 capítulo de Provérbios (o último dia, só Provérbios 31): oração e sabedoria.", days: 31, build: psalmsAndProverbs },
];

function psalmsAndProverbs(): Schedule {
  return Array.from({ length: 31 }, (_, i) => {
    const d = i + 1;
    // 150 psalms over 30 days (d, d+30, d+60, d+90, d+120); the 31st day has only the last chapter of Proverbs
    return { day: d, chapters: (d <= 30 ? [0, 30, 60, 90, 120].map((k) => `PSA.${d + k}`) : []).concat(`PRO.${d}`) };
  });
}

/** A plan of the student's own: from one book to another, in a number of days. */
export function customSchedule(fromBook: string, toBook: string, days: number): Schedule | null {
  const a = CODES.indexOf(fromBook), b = CODES.indexOf(toBook);
  if (a < 0 || b < a) return null;
  const chapters = chaptersOf(CODES.slice(a, b + 1));
  return chapters.length ? distribute(chapters, Math.min(Math.max(1, Math.floor(days)), 1200)) : null;
}

const DAY_MS = 86400000;
const dateOnly = (d: string | Date) => { const x = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); return x.getTime(); };

/** Which day of the plan is today (1-based); 0 before it starts. */
export function todayIndex(startDate: string, today: Date = new Date()): number {
  return Math.floor((dateOnly(today) - dateOnly(startDate)) / DAY_MS) + 1;
}

export interface PlanStatus { today: number; total: number; done: number; behind: number; finished: boolean; nextDay: number | null; percent: number }
/** Where the student is in the plan: days done, days behind (due days not done) and the next day to read (the first not done, which may be earlier than today). */
export function planStatus(schedule: Schedule, doneDays: number[], startDate: string, today: Date = new Date()): PlanStatus {
  const total = schedule.length;
  const done = new Set(doneDays);
  const t = todayIndex(startDate, today);
  let behind = 0;
  for (let d = 1; d <= Math.min(t - 1, total); d++) if (!done.has(d)) behind++;
  const nextDay = schedule.map((s) => s.day).find((d) => !done.has(d)) ?? null;
  return { today: t, total, done: done.size, behind, finished: done.size >= total, nextDay, percent: Math.round((done.size / total) * 100) };
}

/** "JHN.3" -> every verse reference of the chapter ("JHN.3.1"...), using the verse count of the reference versification. */
export function chapterVerseRefs(chapter: string): string[] {
  return Array.from({ length: versesIn(chapter) }, (_, i) => `${chapter}.${i + 1}`);
}
