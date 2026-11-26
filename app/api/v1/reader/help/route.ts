// Help for the verses being read (spec 8.24, RF-M24-05).
//   GET  ?version=&ref=JHN.3.16[&to=JHN.3.18]  -> people and places with their entry, words in the original, related passages (no model)
//   POST {version_id, ref_start, ref_end?, locale}  -> { text, citations, cached } the teacher's short explanation (plan quota; kept per student)
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { addUsage, enforceLimit } from "@/lib/entitlements/guard";
import { readLenses } from "@/lib/auth/preferences";
import { buildHelp, explainPassage } from "@/lib/reading/help";
import { ExplainInput, rangeRefs, verseRef } from "@/lib/reading/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const p = new URL(req.url).searchParams;
    const version = p.get("version") ?? "";
    const ref = p.get("ref") ?? "", to = p.get("to") ?? undefined;
    if (!/^[a-z0-9_]{2,60}$/i.test(version) || !verseRef.safeParse(ref).success || (to && !verseRef.safeParse(to).success)) throw new HttpError(400, "invalid_request");
    return Response.json(await buildHelp(version, rangeRefs(ref, to)));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = ExplainInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { version_id, ref_start, ref_end, locale, refresh } = parsed.data;
    const refs = rangeRefs(ref_start, ref_end, 12);
    const key = `${ref_start}${ref_end && ref_end !== ref_start ? `-${ref_end}` : ""}`;
    const lenses = await readLenses(db, user.id).catch(() => [] as string[]);
    const lens = lenses.slice().sort().join(",");
    if (!refresh) {
      const { data: hit } = await db.from("verse_help").select("text, citations").eq("user_id", user.id).eq("version_id", version_id).eq("ref", key).eq("locale", locale).eq("lens", lens).maybeSingle();
      if (hit) return Response.json({ text: hit.text, citations: hit.citations, cached: true });
    }
    await enforceLimit(db, user.id, "text_messages_day");
    const help = await buildHelp(version_id, refs);
    const out = await explainPassage(help, { locale, lens: lenses });
    if (!out) throw new HttpError(503, "explain_unavailable");
    await addUsage(db, "text_messages", 1).catch(() => undefined);
    await db.from("verse_help").upsert({ user_id: user.id, version_id, ref: key, locale, lens, text: out.text, citations: out.citations }, { onConflict: "user_id,version_id,ref,locale,lens" });
    return Response.json({ text: out.text, citations: out.citations, cached: false });
  } catch (e) {
    return errorResponse(e);
  }
}
