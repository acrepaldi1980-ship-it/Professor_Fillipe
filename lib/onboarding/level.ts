// Level estimate (RF-M03-02) and continuous adjustment (RF-M03-05). Pure functions: the same answers always give the same level.
export type Level = "iniciante" | "intermediário" | "avançado";
export type Experience = "starting" | "lt_2y" | "2_10y" | "gt_10y";
export type MinistryRole = "none" | "ebd_teacher" | "preacher" | "pastor" | "leader" | "student_theology" | "other";

export const EXPERIENCE_POINTS: Record<Experience, number> = { starting: 0, lt_2y: 15, "2_10y": 30, gt_10y: 40 };
export const ROLE_POINTS: Record<MinistryRole, number> = { none: 0, other: 0, leader: 10, ebd_teacher: 15, preacher: 20, pastor: 25, student_theology: 30 };

// Technical vocabulary (accent-insensitive, as stems). Each distinct term found is worth 6 points, up to 30 (RF-M03-02).
const TERMS = [
  "exegese", "exegetic", "hermeneutic", "alianca", "escatolog", "pericope", "soteriolog", "cristolog", "pneumatolog", "eclesiolog",
  "dispensacion", "justificacao", "santificacao", "expiacao", "propiciacao", "septuaginta", "parusia", "kerygma", "koine", "logos",
  "agape", "shalom", "midrash", "canon", "apocrifo", "pentateuco", "sinotico", "epistola", "teofania", "predestinacao", "arminian", "calvinis",
  "kenosis", "hipostatic", "trindade", "milenio", "arrebatamento", "pneuma", "ruach", "grego", "hebraico", "original",
];

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function vocabularyScore(...texts: string[]): number {
  const t = fold(texts.join(" "));
  const found = TERMS.filter((term) => t.includes(term)).length;
  return Math.min(30, found * 6);
}

export interface LevelInput {
  experience: Experience;
  role: MinistryRole;
  openAnswers: string[];
}

export function levelFromScore(score: number): Level {
  return score >= 70 ? "avançado" : score >= 35 ? "intermediário" : "iniciante";
}

export function computeLevel(i: LevelInput): { score: number; level: Level; parts: { experience: number; role: number; vocabulary: number } } {
  const parts = { experience: EXPERIENCE_POINTS[i.experience], role: ROLE_POINTS[i.role], vocabulary: vocabularyScore(...i.openAnswers) };
  const score = Math.min(100, parts.experience + parts.role + parts.vocabulary);
  return { score, level: levelFromScore(score), parts };
}

export type LevelSignal = "lower" | "same" | "higher";

/** Every 5 sessions: if 3 of the last 5 point to another level, the teacher offers to change it (the student confirms). */
export function suggestLevelChange(signals: LevelSignal[], sessionCount: number, current: Level): Level | null {
  if (sessionCount < 5 || sessionCount % 5 !== 0) return null;
  const last = signals.slice(-5);
  if (last.length < 5) return null;
  const order: Level[] = ["iniciante", "intermediário", "avançado"];
  const i = order.indexOf(current);
  if (last.filter((s) => s === "higher").length >= 3 && i < 2) return order[i + 1];
  if (last.filter((s) => s === "lower").length >= 3 && i > 0) return order[i - 1];
  return null;
}
