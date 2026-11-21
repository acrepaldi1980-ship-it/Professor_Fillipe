// Guided modes on the server: session setup, original-language sources for Aprofundar and the live documents
// (lesson plan, sermon outline) that the conversation fills in through `mode_payload`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOriginalWords } from "../knowledge/original";
import { findReferences, formatRefPt } from "../knowledge/refs-parser";
import type { TeacherResponse } from "../teacher/schema";
import { applyLessonPayload, applySermonPayload, LessonPlan, SermonOutline } from "./schema";

export interface SessionMode {
  id: string;
  mode: string;
  context: Record<string, unknown>;
  topic: string | null;
}

export async function loadSessionMode(db: SupabaseClient, sessionId: string): Promise<SessionMode | null> {
  const { data } = await db.from("sessions").select("id, mode, context, topic").eq("id", sessionId).maybeSingle();
  return data ? { id: data.id, mode: data.mode, context: (data.context ?? {}) as Record<string, unknown>, topic: data.topic } : null;
}

export async function sermonTypeDefinition(db: SupabaseClient, name: unknown): Promise<string | undefined> {
  if (typeof name !== "string") return undefined;
  const { data } = await db.from("sermon_types").select("definition").eq("name", name).maybeSingle();
  return data?.definition;
}

/** Aprofundar (8.7.4): original words with transliteration, Strong, gloss and the lexicon entry of the key words. */
export async function deepSources(ref: unknown): Promise<string | undefined> {
  if (typeof ref !== "string") return undefined;
  const refs = findReferences(ref).flatMap((r) => r.refs);
  if (!refs.length) return undefined;
  try {
    const words = (await getOriginalWords(refs[0])).filter((w) => w.strong);
    if (!words.length) return undefined;
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const w of words) {
      if (seen.has(w.strong!) || lines.length >= 24) continue;
      seen.add(w.strong!);
      lines.push(`- ${w.surface}${w.translit ? ` (${w.translit})` : ""}, lema ${w.lemma ?? "?"}, Strong ${w.strong}${w.gloss ? `, "${w.gloss}"` : ""}${w.lexicon ? `: ${w.lexicon.slice(0, 160)}` : ""}`);
    }
    return `TEXTO ORIGINAL de ${formatRefPt(refs[0])} (STEPBible, CC BY 4.0), palavra por palavra:\n${lines.join("\n")}`;
  } catch {
    return undefined;
  }
}

/** What the setup already tells us, so the document is never empty at the start (stored edits always win over it). */
export function seedDocument(mode: string, ctx: Record<string, unknown>): Record<string, unknown> {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  if (mode === "lesson") {
    const ref = str(ctx.ref);
    return { ...(str(ctx.topic) ? { title: str(ctx.topic) } : {}), ...(ref ? { base_text: ref } : {}) };
  }
  if (mode === "sermon") {
    const rt = str(ctx.ref_or_theme);
    const isRef = !!rt && findReferences(rt).some((r) => r.refs.length > 0);
    return { ...(str(ctx.sermon_type) ? { type: str(ctx.sermon_type) } : {}), ...(rt ? (isRef ? { base_text: rt } : { title: rt }) : {}) };
  }
  return {};
}

/** Writes the mode_payload of the turn into the session's document. Returns what changed (for the interface). */
export async function applyModePayload(db: SupabaseClient, userId: string, session: SessionMode, response: TeacherResponse, userText: string): Promise<"lesson" | "sermon" | null> {
  if (!response.mode_payload) return null;
  if (session.mode === "lesson") {
    const { data: row } = await db.from("lesson_plans").select("id, data").eq("session_id", session.id).maybeSingle();
    const next = applyLessonPayload(LessonPlan.parse({ ...seedDocument("lesson", session.context), ...((row?.data as object | undefined) ?? {}) }), response.mode_payload);
    if (!next) return null;
    await db.from("lesson_plans").upsert({ ...(row ? { id: row.id } : {}), user_id: userId, session_id: session.id, data: next }, { onConflict: "id" });
    return "lesson";
  }
  if (session.mode === "sermon") {
    const { data: row } = await db.from("sermon_outlines").select("id, data").eq("session_id", session.id).maybeSingle();
    const next = applySermonPayload(SermonOutline.parse({ ...seedDocument("sermon", session.context), ...((row?.data as object | undefined) ?? {}) }), response.mode_payload, userText);
    if (!next) return null;
    const type = typeof session.context.sermon_type === "string" ? session.context.sermon_type : null;
    const typeId = type ? (await db.from("sermon_types").select("id").eq("name", type).maybeSingle()).data?.id : undefined;
    await db.from("sermon_outlines").upsert({ ...(row ? { id: row.id } : {}), user_id: userId, session_id: session.id, sermon_type_id: typeId ?? null, data: { ...next, type: next.type ?? type ?? undefined } }, { onConflict: "id" });
    return "sermon";
  }
  return null;
}
