// Review workflow of own notes (spec 8.11): draft -> in_review -> approved -> published. Mirrors the database trigger
// own_notes_guard (migration 0011); the database is the real enforcement, this gives clear answers and UI buttons.
export type NoteStatus = "draft" | "in_review" | "approved" | "published";
export type Role = "student" | "church_admin" | "church_teacher" | "reviewer" | "admin";

const MOVES: Record<NoteStatus, NoteStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["in_review", "published"],
  published: ["draft"],
};

export function canMove(from: NoteStatus, to: NoteStatus, role: Role): boolean {
  if (!MOVES[from].includes(to)) return false;
  if (to === "published" || from === "published") return role === "admin";
  return role === "admin" || role === "reviewer";
}

export const nextMoves = (from: NoteStatus, role: Role) => MOVES[from].filter((to) => canMove(from, to, role));
