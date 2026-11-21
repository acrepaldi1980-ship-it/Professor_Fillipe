// Study streak and milestones (Prompt 2.7). Gentle on purpose: a streak that is alive until the end of today, a handful of milestones, no points or ranking.
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

export interface StreakInfo { current: number; best: number; total_days: number; studied_today: boolean }

const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const DAY = 86_400_000;

/** `days`: distinct study days (YYYY-MM-DD) in any order; `today`: the student's today (YYYY-MM-DD) in their time zone. */
export function computeStreak(days: string[], today: string): StreakInfo {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0, run = 0, prev = 0;
  for (const d of sorted) {
    const t = parse(d);
    run = prev && t - prev === DAY ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  const studiedToday = set.has(today);
  // alive while the last study day is today or yesterday
  let cursor = parse(today) - (studiedToday ? 0 : DAY);
  let current = 0;
  const has = (t: number) => set.has(new Date(t).toISOString().slice(0, 10));
  while (has(cursor)) { current++; cursor -= DAY; }
  return { current, best: Math.max(best, current), total_days: set.size, studied_today: studiedToday };
}

/** The milestone kinds reached by a streak (e.g. streak 8 -> ["streak_3", "streak_7"]). */
export const reachedStreakMilestones = (best: number) => STREAK_MILESTONES.filter((m) => best >= m).map((m) => `streak_${m}`);

/** Today's date (YYYY-MM-DD) in a time zone; falls back to Brasília time for an unknown zone. */
export function todayIn(tz: string, now = new Date()): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
  catch { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
}
