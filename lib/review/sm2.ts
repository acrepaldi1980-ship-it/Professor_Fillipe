// Spaced repetition, simplified SM-2 (spec RF-M09-02), exactly as written:
// - a card starts with ease 2.5 and interval 1 day;
// - the answer is graded wrong (1), partial (3) or right (5);
// - grade < 3: the interval goes back to 1 day; grade >= 3: intervals 1 -> 6 -> previous interval x ease;
// - new ease = ease + (0.1 - (5 - grade) x (0.08 + (5 - grade) x 0.02)), minimum 1.3.
export type Grade = 1 | 3 | 5;
export const GRADE_OF = { wrong: 1, partial: 3, right: 5 } as const;
export type Verdict = keyof typeof GRADE_OF;

export interface CardState {
  ease: number;
  interval_days: number;
  repetitions: number;
}
export const NEW_CARD: CardState = { ease: 2.5, interval_days: 1, repetitions: 0 };

export function nextEase(ease: number, grade: number): number {
  const q = 5 - grade;
  return Math.max(1.3, Math.round((ease + (0.1 - q * (0.08 + q * 0.02))) * 100) / 100);
}

export function schedule(card: CardState, grade: Grade, now: Date): CardState & { due_at: Date } {
  const ease = nextEase(card.ease, grade);
  let interval: number;
  let repetitions: number;
  if (grade < 3) {
    interval = 1;
    repetitions = 0;
  } else {
    repetitions = card.repetitions + 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(card.interval_days * card.ease);
  }
  const due = new Date(now.getTime() + interval * 86_400_000);
  return { ease, interval_days: interval, repetitions, due_at: due };
}

/** Cards due now (or earlier), oldest first. */
export const isDue = (dueAt: Date | string, now: Date) => new Date(dueAt).getTime() <= now.getTime();
