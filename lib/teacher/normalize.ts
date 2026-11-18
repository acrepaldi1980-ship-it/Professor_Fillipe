// Lenient clean-up of the model's raw `teacher_response` before strict validation. Free-tier models often fill
// citation fields inconsistently (a Bible window cited as "bible" with only a chunk_id, a work without work_id,
// a human-readable reference like "Atos 13:1-5"). The facts are still verified later (verifyCitations);
// this only fixes the shape so a correct answer is not thrown away.
import { parseReference } from "../knowledge/refs-parser";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function normalizeCitation(c: unknown, mainVersionId: string): Record<string, string> | null {
  if (!isObj(c)) return null;
  const chunk = str(c.chunk_id);
  const ref = str(c.ref);
  const label = str(c.label);

  // Anything that points at a retrieved chunk is a work citation (this includes Bible windows).
  if (chunk && (c.type === "work" || !ref)) {
    return { type: "work", work_id: str(c.work_id) ?? chunk.split(":")[0], chunk_id: chunk, label: label ?? ref ?? chunk };
  }
  if (ref) {
    const canonical = /^[0-9A-Z]{3}\.\d+/.test(ref) ? [ref] : parseReference(ref);
    if (!canonical?.length) return null;
    const version = (str(c.version_id) ?? mainVersionId).replace(/^bible_/, "");
    return { type: "bible", ref: canonical[0], version_id: version };
  }
  return null;
}

/** Free-tier models sometimes emit field names with stray spaces ("ref "): trim keys everywhere. */
function trimKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(trimKeys);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, val]) => [k.trim(), trimKeys(val)]));
  return v;
}

export function normalizeRaw(input: unknown, mainVersionId: string): unknown {
  const raw = trimKeys(input);
  if (!isObj(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };
  if (Array.isArray(out.citations)) {
    out.citations = out.citations.map((c) => normalizeCitation(c, mainVersionId)).filter(Boolean);
  } else if (out.citations !== undefined) {
    out.citations = [];
  }
  // optional fields that models sometimes send as null
  for (const k of ["visuals", "avatar_cue", "mode_payload"] as const) if (out[k] === null && k !== "mode_payload") delete out[k];
  if (out.visuals === undefined) out.visuals = [];
  return out;
}
