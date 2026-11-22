import { describe, expect, it } from "vitest";
import { speakQueue } from "@/lib/voice/speak-queue";

const blob = (s: string) => new Blob([s]);
function fakePlayer() {
  const log: string[] = [];
  return { log, enqueue: async (b: Blob, h?: { onStart?: () => void }) => { log.push(`enqueue:${await b.text()}`); h?.onStart?.(); } };
}

describe("speak queue", () => {
  it("requests the next sentences while earlier ones are still being prepared, and keeps the order", async () => {
    const asked: string[] = [];
    const p = fakePlayer();
    const r = await speakQueue(["a", "b", "c", "d"], { fetchAudio: async (s) => { asked.push(s); await new Promise((x) => setTimeout(x, s === "a" ? 30 : 1)); return blob(s); }, player: p, isCurrent: () => true });
    expect(asked.slice(0, 3)).toEqual(["a", "b", "c"]); // three in flight at once
    expect(p.log).toEqual(["enqueue:a", "enqueue:b", "enqueue:c", "enqueue:d"]);
    expect(r).toEqual({ played: 4, failedAt: null });
  });
  it("tells when the first sound is audible, once", async () => {
    let n = 0;
    await speakQueue(["a", "b"], { fetchAudio: async (s) => blob(s), player: fakePlayer(), isCurrent: () => true, onFirstSound: () => n++ });
    expect(n).toBe(1);
  });
  it("stops at the first sentence the server could not speak and says where, so the device voice can take over", async () => {
    const p = fakePlayer();
    const r = await speakQueue(["a", "b", "c"], { fetchAudio: async (s) => { if (s === "b") throw new Error("down"); return blob(s); }, player: p, isCurrent: () => true });
    expect(r).toEqual({ played: 1, failedAt: 1 });
    expect(p.log).toEqual(["enqueue:a"]);
  });
  it("plays nothing more once the answer is cancelled", async () => {
    let cur = true;
    const p = fakePlayer();
    await speakQueue(["a", "b", "c"], { fetchAudio: async (s) => { if (s === "a") cur = false; return blob(s); }, player: p, isCurrent: () => cur });
    expect(p.log).toEqual([]);
  });
});
