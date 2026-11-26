// Reading plans (spec 8.24, RF-M24-03).
//   GET              -> { catalog: [...], mine: [{ id, key, name, start_date, paused, status }] }
//   GET ?id=<uuid>   -> the plan with its schedule (day -> chapters) and the done days
//   POST {key, start_date, name?, custom?}   starts a plan (catalog key, or key "custom" with {from,to,days})
//   PATCH {id, day, done}  marks a day done (its chapters become read) or undone;  PATCH {id, paused}
//   DELETE ?id=      removes a plan
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { CATALOG, chapterVerseRefs, customSchedule, planStatus, type Schedule } from "@/lib/reading/plans";
import { PlanCreate, PlanPatch } from "@/lib/reading/schema";

export const runtime = "nodejs";
const todayOf = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date());

export async function GET(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const p = new URL(req.url).searchParams;
    const today = todayOf(p.get("today"));
    const id = p.get("id");
    if (id) {
      const { data } = await db.from("reading_plans").select("id,key,name,start_date,schedule,done_days,paused").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (!data) throw new HttpError(404, "not_found");
      return Response.json({ plan: { ...data, status: planStatus(data.schedule as Schedule, data.done_days as number[], data.start_date as string, today) } });
    }
    const { data } = await db.from("reading_plans").select("id,key,name,start_date,schedule,done_days,paused").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    const mine = (data ?? []).map((r) => ({ id: r.id, key: r.key, name: r.name, start_date: r.start_date, paused: r.paused, status: planStatus(r.schedule as Schedule, r.done_days as number[], r.start_date as string, today) }));
    return Response.json({ catalog: CATALOG.map(({ key, name, description, days }) => ({ key, name, description, days })), mine });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = PlanCreate.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { key, start_date, custom } = parsed.data;
    let schedule: Schedule | null = null;
    let name = parsed.data.name;
    if (key === "custom") {
      if (!custom) throw new HttpError(400, "invalid_request");
      schedule = customSchedule(custom.from, custom.to, custom.days);
      name ??= `${custom.from}–${custom.to}, ${schedule?.length ?? custom.days} dias`;
    } else {
      const c = CATALOG.find((x) => x.key === key);
      if (!c) throw new HttpError(404, "plan_not_found");
      schedule = c.build();
      name ??= c.name;
    }
    if (!schedule) throw new HttpError(400, "invalid_plan");
    const { count } = await db.from("reading_plans").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count ?? 0) >= 12) throw new HttpError(409, "too_many_plans");
    const { data, error } = await db.from("reading_plans").insert({ user_id: user.id, key, name, start_date, schedule }).select("id").single();
    if (error || !data) throw new HttpError(500, "save_failed");
    return Response.json({ id: data.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = PlanPatch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const { id, day, done, paused } = parsed.data;
    const { data: plan } = await db.from("reading_plans").select("schedule, done_days").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!plan) throw new HttpError(404, "not_found");
    const patch: Record<string, unknown> = {};
    if (paused !== undefined) patch.paused = paused;
    if (day !== undefined && done !== undefined) {
      const d = (plan.schedule as Schedule).find((x) => x.day === day);
      if (!d) throw new HttpError(400, "invalid_day");
      const set = new Set(plan.done_days as number[]);
      if (done) set.add(day); else set.delete(day);
      patch.done_days = [...set].sort((a, b) => a - b);
      // reading the day counts as reading its chapters
      if (done) {
        const refs = d.chapters.flatMap(chapterVerseRefs);
        const now = new Date().toISOString();
        for (let i = 0; i < refs.length; i += 500) await db.from("bible_reads").upsert(refs.slice(i, i + 500).map((ref) => ({ user_id: user.id, ref, read_at: now })), { onConflict: "user_id,ref", ignoreDuplicates: true });
      }
    }
    if (!Object.keys(patch).length) throw new HttpError(400, "invalid_request");
    const { error } = await db.from("reading_plans").update(patch).eq("id", id).eq("user_id", user.id);
    if (error) throw new HttpError(500, "save_failed");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "invalid_request");
    await db.from("reading_plans").delete().eq("id", id).eq("user_id", user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
