import { LANG_INFO, toLang } from "../i18n/languages";
// Study preferences: lenses (sensitive, encrypted, only with the religious-data consent) and Bible versions (server only).
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptField, encryptField, isEncrypted } from "../security/field-crypto";
import { DEFAULT_BIBLE, type BibleSettings } from "../teacher/prompts";
import { loadConsents } from "./profile";

export const LENSES = ["pentecostal", "baptist", "reformed", "wesleyan", "lutheran", "anabaptist", "dispensational", "catholic", "orthodox"] as const;
export type Lens = (typeof LENSES)[number];

export async function loadBibleSettings(db: SupabaseClient, userId: string): Promise<BibleSettings> {
  const [{ data: p }, consents] = await Promise.all([
    db.from("preferences").select("lenses_enc, main_version_id, compare_version_ids").eq("user_id", userId).maybeSingle(),
    loadConsents(db, userId),
  ]);
  let lenses: string[] = [];
  if (p?.lenses_enc && isEncrypted(p.lenses_enc) && consents.sensitive_religious?.granted) {
    try {
      lenses = (JSON.parse(decryptField(p.lenses_enc)) as string[]).filter((l) => (LENSES as readonly string[]).includes(l));
    } catch {
      lenses = [];
    }
  }
  // The church may set a default lens and version; the student's own choice always wins (and can widen it).
  let churchVersion: string | null = null;
  if (!lenses.length || !p?.main_version_id) {
    const { data: ch } = await db.from("churches").select("default_lenses, default_version_id").limit(1).maybeSingle();
    if (ch && !lenses.length && consents.sensitive_religious?.granted) lenses = ((ch.default_lenses as string[] | null) ?? []).filter((l) => (LENSES as readonly string[]).includes(l));
    if (ch?.default_version_id && !p?.main_version_id) churchVersion = ch.default_version_id as string;
  }
  // a student of another language with no version of their own starts with that language's default (Reina-Valera 1909, World English Bible, Diodati 1885)
  const { data: prof } = await db.from("profiles").select("locale").eq("user_id", userId).maybeSingle();
  const lang = toLang(prof?.locale);
  const base = lang === "pt-BR" ? DEFAULT_BIBLE.main_version_id : LANG_INFO[lang].defaultVersion;
  const ids = [p?.main_version_id ?? churchVersion ?? base, ...(p?.compare_version_ids ?? [])];
  const { data: names } = await db.from("bible_versions").select("id,name").in("id", ids);
  const nameOf = (id: string) => names?.find((n) => n.id === id)?.name ?? id;
  const main = ids[0];
  return { lenses, main_version_id: main, main_version_name: main === DEFAULT_BIBLE.main_version_id ? DEFAULT_BIBLE.main_version_name : nameOf(main), compare_versions: ids.slice(1).map(nameOf) };
}

export async function saveLenses(db: SupabaseClient, userId: string, lenses: Lens[]) {
  const row = { user_id: userId, lenses_enc: lenses.length ? encryptField(JSON.stringify(lenses)) : null };
  return db.from("preferences").upsert(row, { onConflict: "user_id" });
}

export async function readLenses(db: SupabaseClient, userId: string): Promise<string[]> {
  return (await loadBibleSettings(db, userId)).lenses;
}
