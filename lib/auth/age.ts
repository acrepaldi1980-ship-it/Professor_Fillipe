// Age rules (RN-09, D-08 decided 18/11/2026): minimum age 13; 13-17 needs the guardian-awareness checkbox;
// minors get the RA-22 teacher mode and cannot subscribe without a guardian.
export function ageOn(birthDate: string | Date, today: Date = new Date()): number {
  const b = typeof birthDate === "string" ? new Date(`${birthDate}T00:00:00`) : birthDate;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

export type AgeStatus = "invalid" | "too_young" | "minor_needs_guardian" | "adult";

export function ageStatus(birthDate: string, today: Date = new Date()): AgeStatus {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return "invalid";
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime()) || d > today) return "invalid";
  const age = ageOn(birthDate, today);
  if (age < 0 || age > 120) return "invalid";
  if (age < 13) return "too_young";
  if (age < 18) return "minor_needs_guardian";
  return "adult";
}
