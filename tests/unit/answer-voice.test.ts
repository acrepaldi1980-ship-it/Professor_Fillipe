import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerVoice } from "@/lib/api-client";

type Call = { text: string; only?: string };
let calls: Call[] = [];
/** A fake voice server: `plan` decides, per call, which voice answers (or an error). */
function fakeServer(plan: (c: Call, n: number) => { voice: string } | "error" | "slow-remote-then-piper") {
  let n = 0;
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const c = JSON.parse(String(init.body)) as Call;
    calls.push(c);
    const r = plan(c, n++);
    if (r === "error") return new Response("{}", { status: 502 });
    const voice = r === "slow-remote-then-piper" ? "piper" : r.voice;
    return new Response(new Blob([`${voice}:${c.text}`]), { status: 200, headers: { "x-voice": voice } });
  });
}
const text = async (p: Promise<Blob>) => (await p).text();

describe("one voice per answer", () => {
  beforeEach(() => { calls = []; });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the main voice for every sentence when it answers", async () => {
    fakeServer(() => ({ voice: "remote" }));
    const v = answerVoice();
    const out = await Promise.all(["a", "b", "c"].map((s, i) => text(v(s, i))));
    expect(out).toEqual(["remote:a", "remote:b", "remote:c"]);
  });

  it("when the first sentence falls back to Piper, the rest are spoken by Piper too (never a mix)", async () => {
    // the strict remote attempts for b and c fail or are discarded; the first sentence got Piper
    fakeServer((c) => (c.only === "remote" ? { voice: "remote" } : c.only === "piper" || !c.only ? { voice: "piper" } : { voice: "piper" }));
    const v = answerVoice();
    const out = await Promise.all(["a", "b", "c"].map((s, i) => text(v(s, i))));
    expect(out.every((o) => o.startsWith("piper:"))).toBe(true);
  });

  it("retries the main voice for a sentence that failed instead of switching voice", async () => {
    let failedOnce = false;
    fakeServer((c) => {
      if (c.text === "b" && c.only === "remote" && !failedOnce) { failedOnce = true; return "error"; }
      return { voice: "remote" };
    });
    const v = answerVoice();
    const out = await Promise.all(["a", "b", "c"].map((s, i) => text(v(s, i))));
    expect(out).toEqual(["remote:a", "remote:b", "remote:c"]);
  });

  it("rejects when even the first sentence cannot be spoken (the screen then uses the device voice)", async () => {
    fakeServer(() => "error");
    const v = answerVoice();
    await expect(v("a", 0)).rejects.toThrow();
    await expect(v("b", 1)).rejects.toThrow();
  });
});
