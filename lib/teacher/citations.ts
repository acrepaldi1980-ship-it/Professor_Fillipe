// Citation verification (spec 8.5.6). The model can only cite what was retrieved or what really exists.
import { findReferences } from "../knowledge/refs-parser";
import type { Citation, TeacherResponse } from "./schema";

export interface RetrievedRef {
  id: string;
  work_id: string;
  title_path: string | null;
}

/** The model often gets the chunk id slightly wrong but names the right entry; re-link by work and title. */
export function repairWorkCitations(raw: TeacherResponse, retrieved: RetrievedRef[]): TeacherResponse {
  const ids = new Set(retrieved.map((r) => r.id));
  const citations = raw.citations.map((c) => {
    if (c.type !== "work" || ids.has(c.chunk_id)) return c;
    const label = c.label.toLowerCase();
    const match = retrieved.find((r) => r.work_id === c.work_id && r.title_path && label.includes(r.title_path.toLowerCase()));
    return match ? { ...c, chunk_id: match.id } : c;
  });
  return { ...raw, citations };
}

export interface VerificationDeps {
  /** Which of these canonical verse refs exist in this Bible version? */
  existingVerses(versionId: string, refs: string[]): Promise<Set<string>>;
  /** Chunk ids that were retrieved for this turn. */
  retrievedChunkIds: Set<string>;
}

export interface VerificationResult {
  response: TeacherResponse;
  removed: Citation[];
  /** Bible references mentioned in `speech` that do not exist (or were not cited) and need a rewrite (8.5.6 step 3). */
  invalidSpeechRefs: string[];
}

const singleVerseRefs = (ref: string): string[] => {
  const [a, b] = ref.split("-");
  if (!b) return [a];
  const [bk, ch, v1] = a.split(".");
  const [, , v2] = b.split(".");
  if (v1 && v2 && a.split(".")[1] === b.split(".")[1]) {
    const out: string[] = [];
    for (let n = Number(v1); n <= Number(v2) && n - Number(v1) < 200; n++) out.push(`${bk}.${ch}.${n}`);
    return out;
  }
  return [a, b];
};

export async function verifyCitations(raw: TeacherResponse, deps: VerificationDeps, mainVersionId: string): Promise<VerificationResult> {
  const kept: Citation[] = [];
  const removed: Citation[] = [];

  // 1) Bible citations must exist in the stated version (chapter-only refs are accepted if the chapter exists).
  const bibleCites = raw.citations.filter((c): c is Extract<Citation, { type: "bible" }> => c.type === "bible");
  const byVersion = new Map<string, string[]>();
  for (const c of bibleCites) byVersion.set(c.version_id, [...(byVersion.get(c.version_id) ?? []), ...singleVerseRefs(c.ref).filter((r) => r.split(".").length === 3)]);
  const existing = new Map<string, Set<string>>();
  for (const [v, refs] of byVersion) existing.set(v, refs.length ? await deps.existingVerses(v, [...new Set(refs)]) : new Set());

  for (const c of raw.citations) {
    if (c.type === "bible") {
      const verses = singleVerseRefs(c.ref).filter((r) => r.split(".").length === 3);
      const ok = verses.length > 0 && verses.every((r) => existing.get(c.version_id)?.has(r));
      (ok ? kept : removed).push(c);
    } else {
      // 2) Work citations must point to a chunk retrieved in this turn.
      (deps.retrievedChunkIds.has(c.chunk_id) ? kept : removed).push(c);
    }
  }

  // 3) References spoken in `speech` must exist.
  const spoken = findReferences(raw.speech).flatMap((r) => (r.invalid ? ["__invalid__"] : r.refs));
  const spokenVerses = [...new Set(spoken.flatMap((r) => (r === "__invalid__" ? [r] : singleVerseRefs(r))))].filter((r) => r === "__invalid__" || r.split(".").length === 3);
  const invalidSpeechRefs: string[] = [];
  if (spokenVerses.length) {
    const real = spokenVerses.filter((r) => r !== "__invalid__");
    const found = real.length ? await deps.existingVerses(mainVersionId, real) : new Set<string>();
    for (const r of spokenVerses) if (r === "__invalid__" || !found.has(r)) invalidSpeechRefs.push(r);
  }

  return { response: { ...raw, citations: kept }, removed, invalidSpeechRefs };
}
