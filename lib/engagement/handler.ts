// Engagement endpoints served by the /api/v1/study/[...path] function (Vercel Hobby allows 12 functions per deployment):
//   GET  /study/paths                  -> the guided paths with the student's progress
//   GET  /study/paths/:id              -> one path with every day and which are done
//   POST /study/paths/start {pathId}   -> starts (or resumes) a path
//   POST /study/paths/day {pathId, day}-> marks a day as done (finishing the last one completes the path)
//   GET  /study/streak?tz=&ack=1       -> study streak and milestones reached (ack=1 marks them as seen)
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { getPath, PATHS, type PathDef } from "@/lib/paths/data";
import { composePersonalPath, PERSONAL_PATH_ID, personalRequest } from "@/lib/paths/personal";
import { computeStreak, reachedStreakMilestones, todayIn } from "./streak";

type Row = { path_id: string; started_at: string; done_days: number[]; completed_at: string | null };

type Db = Awaited<ReturnType<typeof requireUser>>["db"];
/** A path by id: the catalog, or the student's own personalised plan (id "meu"). */
export async function resolvePath(db: Db, userId: string, id: string): Promise<PathDef | undefined> {
  if (id !== PERSONAL_PATH_ID) return getPath(id);
  const { data } = await db.from("personal_paths").select("plan").eq("user_id", userId).maybeSingle();
  return (data?.plan as PathDef | undefined) ?? undefined;
}

export async function pathsGet(req: Request, id?: string) {
  try {
    const { user, db } = await requireUser(req);
    const { data } = await db.from("path_progress").select("path_id, started_at, done_days, completed_at").eq("user_id", user.id);
    const rows = new Map((data as Row[] | null ?? []).map((r) => [r.path_id, r]));
    const mine = id === PERSONAL_PATH_ID || !id ? await resolvePath(db, user.id, PERSONAL_PATH_ID) : undefined;
    const view = (p: PathDef) => {
      const r = rows.get(p.id);
      const done = r?.done_days ?? [];
      const next = p.days.find((x) => !done.includes(x.day)) ?? null;
      return { id: p.id, title: p.title, description: p.description, level: p.level, personal: !!p.personal, total: p.days.length, done: done.length, started: !!r, completed: !!r?.completed_at, next_day: next ? { day: next.day, title: next.title } : null };
    };
    if (id) {
      const p = id === PERSONAL_PATH_ID ? mine : getPath(id);
      if (!p) throw new HttpError(404, "not_found");
      return Response.json({ ...view(p), promise: p.promise ?? null, adjust: p.adjust ?? null, weeks: p.weeks ?? [], days: p.days.map((x) => ({ ...x, done: (rows.get(p.id)?.done_days ?? []).includes(x.day) })) });
    }
    return Response.json({ paths: [...(mine ? [mine] : []), ...PATHS].map(view) });
  } catch (e) {
    return errorResponse(e);
  }
}

const startBody = z.object({ pathId: z.string().max(40) });
const dayBody = z.object({ pathId: z.string().max(40), day: z.number().int().min(1).max(60) });

export async function pathsPost(req: Request, action: "start" | "day") {
  try {
    const { user, db } = await requireUser(req);
    const raw = await req.json().catch(() => null);
    const parsed = (action === "start" ? startBody : dayBody).safeParse(raw);
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const path = await resolvePath(db, user.id, parsed.data.pathId);
    if (!path) throw new HttpError(404, "not_found");
    const { data: row } = await db.from("path_progress").select("id, done_days, completed_at").eq("user_id", user.id).eq("path_id", path.id).maybeSingle();
    if (action === "start") {
      if (!row) await db.from("path_progress").insert({ user_id: user.id, path_id: path.id });
      return Response.json({ ok: true });
    }
    const day = (parsed.data as z.infer<typeof dayBody>).day;
    if (day > path.days.length) throw new HttpError(400, "invalid_day");
    const done = [...new Set([...(row?.done_days ?? []), day])].sort((a, b) => a - b);
    const completed = done.length >= path.days.length;
    const patch = { done_days: done, completed_at: completed ? row?.completed_at ?? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    if (row) await db.from("path_progress").update(patch).eq("id", row.id); else await db.from("path_progress").insert({ user_id: user.id, path_id: path.id, ...patch });
    let milestone: string | null = null;
    if (completed && !row?.completed_at) {
      milestone = `path_${path.id}`;
      await db.from("user_milestones").upsert({ user_id: user.id, kind: milestone }, { onConflict: "user_id,kind", ignoreDuplicates: true });
    }
    return Response.json({ ok: true, done: done.length, total: path.days.length, completed, milestone });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /study/paths/personal: composes the student's plan from the profile (or recomposes it on the weekly review, keeping what was done). */
export async function personalPathPost(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const parsed = personalRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "invalid_request");
    const prev = await resolvePath(db, user.id, PERSONAL_PATH_ID);
    let kept: PathDef["days"] = [];
    let version = 1;
    if (prev) {
      const { data: row } = await db.from("path_progress").select("done_days").eq("user_id", user.id).eq("path_id", PERSONAL_PATH_ID).maybeSingle();
      const done = new Set<number>(row?.done_days ?? []);
      kept = prev.days.filter((x) => done.has(x.day));
      const { data: p } = await db.from("personal_paths").select("version").eq("user_id", user.id).maybeSingle();
      version = (p?.version ?? 0) + 1;
    }
    const { doneNumbers, ...plan } = composePersonalPath(parsed.data, kept);
    const { error } = await db.from("personal_paths").upsert({ user_id: user.id, request: parsed.data, plan, version, updated_at: new Date().toISOString() });
    if (error) throw new HttpError(500, "path_failed");
    const patch = { done_days: doneNumbers, completed_at: null, updated_at: new Date().toISOString() };
    const { data: pr } = await db.from("path_progress").select("id").eq("user_id", user.id).eq("path_id", PERSONAL_PATH_ID).maybeSingle();
    if (pr) await db.from("path_progress").update(patch).eq("id", pr.id); else await db.from("path_progress").insert({ user_id: user.id, path_id: PERSONAL_PATH_ID, ...patch });
    return Response.json({ ok: true, id: PERSONAL_PATH_ID, total: plan.days.length, version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function streakGet(req: Request) {
  try {
    const { user, db } = await requireUser(req);
    const url = new URL(req.url);
    const tz = (url.searchParams.get("tz") ?? "America/Sao_Paulo").slice(0, 60);
    const { data, error } = await db.rpc("study_days", { p_tz: tz });
    if (error) throw new HttpError(500, "streak_failed");
    const days = ((data ?? []) as { day: string }[]).map((r) => r.day);
    const info = computeStreak(days, todayIn(tz));
    // milestones: record the new ones and report those not yet seen
    const reached = reachedStreakMilestones(info.best);
    if (reached.length) await db.from("user_milestones").upsert(reached.map((kind) => ({ user_id: user.id, kind })), { onConflict: "user_id,kind", ignoreDuplicates: true });
    const { data: ms } = await db.from("user_milestones").select("kind, reached_at, seen").eq("user_id", user.id).eq("seen", false);
    const fresh = (ms ?? []).map((m) => m.kind as string);
    if (url.searchParams.get("ack") && fresh.length) await db.from("user_milestones").update({ seen: true }).eq("user_id", user.id).in("kind", fresh);
    return Response.json({ ...info, new_milestones: fresh });
  } catch (e) {
    return errorResponse(e);
  }
}
