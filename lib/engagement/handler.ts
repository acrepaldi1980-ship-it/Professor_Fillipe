// Engagement endpoints served by the /api/v1/study/[...path] function (Vercel Hobby allows 12 functions per deployment):
//   GET  /study/paths                  -> the guided paths with the student's progress
//   GET  /study/paths/:id              -> one path with every day and which are done
//   POST /study/paths/start {pathId}   -> starts (or resumes) a path
//   POST /study/paths/day {pathId, day}-> marks a day as done (finishing the last one completes the path)
//   GET  /study/streak?tz=&ack=1       -> study streak and milestones reached (ack=1 marks them as seen)
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/auth/server";
import { getPath, PATHS } from "@/lib/paths/data";
import { computeStreak, reachedStreakMilestones, todayIn } from "./streak";

type Row = { path_id: string; started_at: string; done_days: number[]; completed_at: string | null };

export async function pathsGet(req: Request, id?: string) {
  try {
    const { user, db } = await requireUser(req);
    const { data } = await db.from("path_progress").select("path_id, started_at, done_days, completed_at").eq("user_id", user.id);
    const rows = new Map((data as Row[] | null ?? []).map((r) => [r.path_id, r]));
    const view = (p: (typeof PATHS)[number]) => {
      const r = rows.get(p.id);
      const done = r?.done_days ?? [];
      const next = p.days.find((x) => !done.includes(x.day)) ?? null;
      return { id: p.id, title: p.title, description: p.description, level: p.level, total: p.days.length, done: done.length, started: !!r, completed: !!r?.completed_at, next_day: next ? { day: next.day, title: next.title } : null };
    };
    if (id) {
      const p = getPath(id);
      if (!p) throw new HttpError(404, "not_found");
      return Response.json({ ...view(p), days: p.days.map((x) => ({ ...x, done: (rows.get(p.id)?.done_days ?? []).includes(x.day) })) });
    }
    return Response.json({ paths: PATHS.map(view) });
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
    const path = getPath(parsed.data.pathId);
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
