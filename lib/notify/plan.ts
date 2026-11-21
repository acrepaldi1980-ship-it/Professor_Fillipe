// What to send to whom, and when (spec 8.15). Pure: the hourly sender feeds it the candidates and sends what it decides.
// Rules: at most 1 a day, never between 22h and 7h in the student's time zone, only around the hour they chose, only the kinds they left on,
// and a short message that opens the right screen. Priority: lesson of the week > trial ending > path > review of the day.
import { getPath } from "@/lib/paths/data";

export interface Candidate {
  user_id: string; tz: string; hour: number; lang: string;
  kinds: Partial<Record<"review" | "path" | "lesson" | "trial", boolean>>;
  last_sent_at: string | null; last_kind?: string | null;
  due_cards: number;
  paths: { path_id: string; done_days: number[] }[];
  lesson_title: string | null;
  trial_end: string | null;
  last_study_at: string | null;
}
export type Kind = "lesson" | "trial" | "path" | "review";
export interface Decision { kind: Kind; params: Record<string, string>; url: string }

export function localParts(now: Date, tz: string): { date: string; hour: number } {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); } catch { zone = "America/Sao_Paulo"; }
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function chooseNotification(c: Candidate, now: Date): Decision | null {
  const here = localParts(now, c.tz);
  if (here.hour < 7 || here.hour >= 22) return null; // quiet hours
  if (here.hour < c.hour || here.hour > c.hour + 1) return null; // around the chosen hour (the sender runs hourly; one missed run is tolerated)
  if (c.last_sent_at && localParts(new Date(c.last_sent_at), c.tz).date === here.date) return null; // 1 a day
  const studiedToday = !!c.last_study_at && localParts(new Date(c.last_study_at), c.tz).date === here.date;
  const k = c.kinds ?? {};
  const recent = (days: number) => !!c.last_sent_at && now.getTime() - new Date(c.last_sent_at).getTime() < days * 86_400_000;

  if (k.lesson !== false && c.lesson_title && !(c.last_kind === "lesson" && recent(6))) return { kind: "lesson", params: { title: c.lesson_title }, url: "/inicio" };
  if (k.trial !== false && c.trial_end) {
    const left = new Date(c.trial_end).getTime() - now.getTime();
    if (left > 0 && left <= 2 * 86_400_000) return { kind: "trial", params: {}, url: "/assinatura" };
  }
  if (k.path !== false && !studiedToday) {
    for (const p of c.paths) {
      const def = getPath(p.path_id);
      const next = def?.days.find((d) => !p.done_days.includes(d.day));
      if (def && next) return { kind: "path", params: { path: def.title, day: String(next.day), title: next.title }, url: `/estudo?trilha=${def.id}&dia=${next.day}` };
    }
  }
  if (k.review !== false && c.due_cards > 0 && !studiedToday) return { kind: "review", params: { n: String(c.due_cards) }, url: "/revisao" };
  return null;
}
