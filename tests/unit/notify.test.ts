import { describe, expect, it } from "vitest";
import { notificationText } from "@/lib/notify/messages";
import { chooseNotification, localParts, type Candidate } from "@/lib/notify/plan";
import { runTick, type Deps, type Row } from "@/lib/notify/send";

// 2026-11-21 22:00 UTC = 19:00 in São Paulo (UTC-3)
const NOW = new Date("2026-11-21T22:00:00Z");
const base: Candidate = { user_id: "u1", tz: "America/Sao_Paulo", hour: 19, lang: "pt-BR", kinds: { review: true, path: true, lesson: true, trial: true }, last_sent_at: null, last_kind: null, due_cards: 0, paths: [], lesson_title: null, trial_end: null, last_study_at: null };

describe("chooseNotification", () => {
  it("sends nothing when there is nothing to say", () => expect(chooseNotification(base, NOW)).toBeNull());
  it("reminds of the review of the day", () => expect(chooseNotification({ ...base, due_cards: 4 }, NOW)).toMatchObject({ kind: "review", params: { n: "4" }, url: "/revisao" }));
  it("only around the chosen hour (one missed run tolerated)", () => {
    expect(chooseNotification({ ...base, due_cards: 1, hour: 20 }, NOW)).toBeNull(); // before the hour
    expect(chooseNotification({ ...base, due_cards: 1, hour: 18 }, NOW)).not.toBeNull(); // the hour before still within tolerance
    expect(chooseNotification({ ...base, due_cards: 1, hour: 17 }, NOW)).toBeNull(); // too late
  });
  it("never between 22h and 7h in the student's time zone", () => {
    const night = new Date("2026-11-22T01:30:00Z"); // 22:30 in São Paulo
    expect(chooseNotification({ ...base, due_cards: 1, hour: 21 }, night)).toBeNull();
    const dawn = new Date("2026-11-21T08:00:00Z"); // 05:00 in São Paulo
    expect(chooseNotification({ ...base, due_cards: 1, hour: 7 }, dawn)).toBeNull();
  });
  it("respects the time zone (Tokyo is already the next morning)", () => {
    expect(chooseNotification({ ...base, tz: "Asia/Tokyo", hour: 7, due_cards: 1 }, new Date("2026-11-21T22:00:00Z"))).not.toBeNull(); // 07:00 in Tokyo
  });
  it("at most one a day", () => {
    expect(chooseNotification({ ...base, due_cards: 2, last_sent_at: "2026-11-21T14:00:00Z" }, NOW)).toBeNull(); // sent today (11:00 local)
    expect(chooseNotification({ ...base, due_cards: 2, last_sent_at: "2026-11-20T22:00:00Z" }, NOW)).not.toBeNull();
  });
  it("respects the kinds the student turned off", () => {
    expect(chooseNotification({ ...base, due_cards: 3, kinds: { review: false } }, NOW)).toBeNull();
  });
  it("priority: lesson of the week, then trial, then path, then review", () => {
    const all = { ...base, due_cards: 3, lesson_title: "Atos 8", trial_end: "2026-11-22T10:00:00Z", paths: [{ path_id: "paulo14", done_days: [1] }] };
    expect(chooseNotification(all, NOW)?.kind).toBe("lesson");
    expect(chooseNotification({ ...all, lesson_title: null }, NOW)?.kind).toBe("trial");
    expect(chooseNotification({ ...all, lesson_title: null, trial_end: null }, NOW)?.kind).toBe("path");
    expect(chooseNotification({ ...all, lesson_title: null, trial_end: null, paths: [] }, NOW)?.kind).toBe("review");
  });
  it("the lesson of the week is announced once, not every day of the week", () => {
    expect(chooseNotification({ ...base, lesson_title: "Atos 8", last_kind: "lesson", last_sent_at: "2026-11-19T22:00:00Z" }, NOW)).toBeNull();
    expect(chooseNotification({ ...base, lesson_title: "Atos 8", last_kind: "review", last_sent_at: "2026-11-19T22:00:00Z" }, NOW)?.kind).toBe("lesson");
  });
  it("the trial reminder only in the last 2 days", () => {
    expect(chooseNotification({ ...base, trial_end: "2026-11-30T10:00:00Z" }, NOW)).toBeNull();
    expect(chooseNotification({ ...base, trial_end: "2026-11-22T10:00:00Z" }, NOW)?.kind).toBe("trial");
    expect(chooseNotification({ ...base, trial_end: "2026-11-20T10:00:00Z" }, NOW)).toBeNull(); // already ended
  });
  it("the path reminder points to the next undone day and is skipped when the student already studied today", () => {
    const c = { ...base, paths: [{ path_id: "paulo14", done_days: [1, 2] }] };
    expect(chooseNotification(c, NOW)).toMatchObject({ kind: "path", params: { day: "3" }, url: "/estudo?trilha=paulo14&dia=3" });
    expect(chooseNotification({ ...c, last_study_at: "2026-11-21T15:00:00Z" }, NOW)).toBeNull();
  });
  it("a bad time zone falls back instead of throwing", () => expect(localParts(NOW, "Nao/Existe").hour).toBe(19));
});

describe("messages", () => {
  it("are short and exist in Portuguese and Spanish", () => {
    const d = { kind: "review" as const, params: { n: "3" }, url: "/revisao" };
    expect(notificationText(d, "pt-BR").body).toContain("3 cartões");
    expect(notificationText(d, "es").body).toContain("3 tarjetas");
    expect(notificationText({ ...d, params: { n: "1" } }, "pt-BR").body).toContain("1 cartão");
    expect(notificationText(d, "fr").title).toBe("Revisão do dia"); // unknown language falls back to Portuguese
  });
});

describe("runTick", () => {
  const sub = JSON.stringify({ endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } });
  const mk = (rows: Row[], send: Deps["send"]) => { const marked: string[] = [], dropped: string[] = []; const deps: Deps = { candidates: async () => rows, mark: async (u, k) => { marked.push(`${u}:${k}`); }, dropDevice: async (id) => { dropped.push(id); }, send }; return { deps, marked, dropped }; };
  const row = (over: Partial<Row> = {}): Row => ({ ...base, due_cards: 2, devices: [{ id: "d1", token: sub, platform: "web" }], ...over });
  it("sends to each device and marks the day", async () => {
    const sent: string[] = [];
    const { deps, marked } = mk([row({ devices: [{ id: "d1", token: sub, platform: "web" }, { id: "d2", token: sub, platform: "web" }] })], async (_s, p) => { sent.push(p); return { statusCode: 201 }; });
    const r = await runTick(deps, NOW);
    expect(r.sent).toBe(1); expect(sent).toHaveLength(2); expect(marked).toEqual(["u1:review"]);
    expect(JSON.parse(sent[0])).toMatchObject({ title: "Revisão do dia", url: "/revisao", tag: "review" });
  });
  it("drops a device the push service says is gone (410) and does not mark a day nobody received", async () => {
    const { deps, marked, dropped } = mk([row()], async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); });
    const r = await runTick(deps, NOW);
    expect(dropped).toEqual(["d1"]); expect(r.dropped).toBe(1); expect(r.sent).toBe(0); expect(marked).toEqual([]);
  });
  it("keeps the device on a temporary error", async () => {
    const { deps, dropped } = mk([row()], async () => { throw Object.assign(new Error("busy"), { statusCode: 503 }); });
    await runTick(deps, NOW);
    expect(dropped).toEqual([]);
  });
  it("drops a device whose token is not valid JSON and skips native tokens", async () => {
    const { deps, dropped } = mk([row({ devices: [{ id: "bad", token: "not json", platform: "web" }, { id: "n", token: "abc", platform: "ios" }] })], async () => ({ statusCode: 201 }));
    const r = await runTick(deps, NOW);
    expect(dropped).toEqual(["bad"]); expect(r.skipped_native).toBe(1);
  });
  it("a dry run decides but sends and marks nothing", async () => {
    let sends = 0;
    const { deps, marked } = mk([row()], async () => { sends++; return { statusCode: 201 }; });
    const r = await runTick(deps, NOW, true);
    expect(r.sent).toBe(1); expect(sends).toBe(0); expect(marked).toEqual([]);
  });
});
