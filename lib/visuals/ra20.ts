// RA-20 filter for image prompts: never generate or describe the face of Jesus, never represent God the Father. Figures of Jesus are shown
// from behind, at a distance, as a silhouette or as light; God the Father is shown only through light, clouds or a hand-less sky. Prompts for
// violence/nudity or against other faiths are refused. Applied before every generation (text in English or Portuguese).
export interface Ra20Result {
  ok: boolean;
  prompt: string;
  /** Why it was changed or refused (never shown as an accusation to the student). */
  reason?: string;
}

const JESUS = /\b(jesus|christ|cristo|messiah|messias|the lord|o senhor jesus|nazarene|nazareno|son of god|filho de deus)\b/i;
const FACE = /\b(face|faces|rosto|rostos|portrait|retrato|close[- ]?up|closeup|eyes|olhos|smiling|sorrindo|looking at the viewer|expression)\b/gi;
const FATHER = /\b(god the father|deus pai|father god|the father|pai celestial|ancient of days|ancião de dias|yahweh|jeov[aá]|jehovah|god himself|the almighty)\b/i;
const REFUSE = /\b(nude|naked|nudez|pelad[oa]|sexual|erotic|er[oó]tic|gore|gory|mutilat|torture scene|decapitat|beheading|blood splatter|swastika|mock(ing)? (of )?(jesus|god|church|muslim|jew)|caricature)\b/i;

export function applyRa20(input: string): Ra20Result {
  const prompt = input.trim().replace(/\s+/g, " ").slice(0, 400);
  if (prompt.length < 8) return { ok: false, prompt, reason: "too_short" };
  if (REFUSE.test(prompt)) return { ok: false, prompt, reason: "not_allowed" };
  let out = prompt;
  let reason: string | undefined;
  if (FATHER.test(out)) {
    out = out.replace(FATHER, "a beam of golden light breaking through clouds").replace(/\b(sitting|seated|standing|appearing|face|hand|hands|beard)\b/gi, "shining");
    reason = "father_as_light";
  }
  if (JESUS.test(out)) {
    // Jesus may appear only from behind, far away or as a silhouette/light; any mention of a face is removed.
    out = out.replace(FACE, "").replace(/\b(of|de|do|da|his|her|seu|sua)(\s+(of|de|his|her|the|seu|sua))*\s*(?=[.,]|$)/gi, "").replace(/\s+([.,])/g, "$1").replace(/[,.]\s*[,.]/g, ",").replace(/\s+/g, " ").trim();
    out = `${out}. Jesus, if present, is a small distant figure seen from behind or a luminous silhouette, never showing a face.`;
    reason = reason ?? "jesus_from_behind";
  }
  return { ok: true, prompt: out, reason };
}
